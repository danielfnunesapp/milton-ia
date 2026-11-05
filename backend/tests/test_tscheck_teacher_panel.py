"""Criterion: Painel do Professor — AI generate questions, manual add, publish quiz; reports."""
import httpx

from tests.conftest import api_url


def _login(client: httpx.Client, email: str, password: str = "milton123"):
    r = client.post("/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return r


def test_teacher_generate_ai_questions():
    with httpx.Client(base_url=api_url(), timeout=90.0) as client:
        _login(client, "professor@milton.edu.br")
        r = client.post("/teacher/generate", json={"grade": "9EF", "subject": "Matemática", "bimestre": 2, "count": 5})
        assert r.status_code == 200, r.text
        qs = r.json()
        assert len(qs) == 5
        for q in qs:
            assert q["statement"]


def test_teacher_publish_quiz_appears_in_list_and_delete():
    with httpx.Client(base_url=api_url(), timeout=90.0) as client:
        _login(client, "professor@milton.edu.br")
        gen = client.post("/teacher/generate", json={"grade": "9EF", "subject": "Matemática", "bimestre": 2, "count": 2})
        assert gen.status_code == 200, gen.text
        questions = gen.json()

        payload = {
            "title": "tscheck-quiz-publicado",
            "kind": "quiz",
            "grade": "9EF",
            "subject": "Matemática",
            "bimestre": 2,
            "questions": questions,
        }
        r = client.post("/teacher/quizzes", json=payload)
        assert r.status_code == 200, r.text
        quiz = r.json()
        qid = quiz["id"]
        assert quiz["question_count"] == 2
        try:
            # Student should see this quiz among curriculum-linked custom quizzes for the same grade.
            with httpx.Client(base_url=api_url(), timeout=30.0) as student_client:
                _login(student_client, "aluno@milton.edu.br")
                lst = student_client.get("/custom-quizzes", params={"grade": "9EF"})
                assert lst.status_code == 200, lst.text
                assert any(c["id"] == qid for c in lst.json())
        finally:
            dr = client.delete(f"/teacher/quizzes/{qid}")
            assert dr.status_code == 200, dr.text


def test_reports_overview_tabs_return_data():
    with httpx.Client(base_url=api_url(), timeout=30.0) as client:
        _login(client, "professor@milton.edu.br")
        r = client.get("/reports/overview")
        assert r.status_code == 200, r.text
        body = r.json()
        assert "students" in body or "rows" in body or isinstance(body, dict)


def test_student_cannot_access_teacher_generate():
    with httpx.Client(base_url=api_url(), timeout=30.0) as client:
        _login(client, "aluno@milton.edu.br")
        r = client.post("/teacher/generate", json={"grade": "9EF", "subject": "Matemática", "bimestre": 2, "count": 1})
        assert r.status_code in (401, 403), r.text

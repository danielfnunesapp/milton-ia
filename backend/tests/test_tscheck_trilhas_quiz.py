"""Criterion: Trilhas quiz flow (cached topic) + quiz player grading/results."""
import httpx


def _login(client: httpx.Client, email: str, password: str = "milton123"):
    r = client.post("/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return r


def test_curriculum_has_bimestres_with_habilidade(client: httpx.Client):
    _login(client, "aluno@milton.edu.br")
    r = client.get("/curriculum/9EF")
    assert r.status_code == 200, r.text
    body = r.json()
    subjects = body["subjects"]
    assert len(subjects) > 0
    topics = subjects[0]["topics"]
    assert len(topics) == 4
    for t in topics:
        assert t["habilidade"]
        assert t["unidade"]
        assert t["objeto"]


def test_quiz_start_cached_topic_and_submit_grades(client: httpx.Client):
    """9EF-matematica-b2 is seeded with cached questions per briefing -> should be fast."""
    _login(client, "aluno@milton.edu.br")
    r = client.post("/quizzes/start", json={"topic_id": "9EF-matematica-b2", "mode": "rapido"})
    assert r.status_code == 200, r.text
    quiz = r.json()
    qs = quiz["questions"]
    assert len(qs) == 5
    attempt_id = quiz["id"]

    # Build answers: pick first option / Verdadeiro for every question type to exercise grading.
    answers = {}
    for q in qs:
        if q["type"] == "association":
            pairs = {l: (q["right"][0] if q["right"] else "") for l in q["left"]}
            answers[q["id"]] = pairs
        else:
            answers[q["id"]] = q["options"][0]

    r2 = client.post(f"/quizzes/attempts/{attempt_id}/submit", json={"answers": answers, "duration_sec": 42})
    assert r2.status_code == 200, r2.text
    result = r2.json()
    assert "correct" in result and "wrong" in result and "total" in result
    assert "xp_earned" in result
    assert result["total"] == 5
    assert len(result["items"]) == 5


def test_quiz_submit_unauthenticated_rejected(client: httpx.Client):
    r = client.post("/quizzes/attempts/does-not-exist/submit", json={"answers": [], "duration_sec": 1})
    assert r.status_code in (401, 403, 404)

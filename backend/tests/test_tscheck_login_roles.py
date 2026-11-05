"""Criterion: login with role-based demo accounts routes correctly; wrong password errors."""
import httpx


def test_student_login_returns_student_role(client: httpx.Client):
    r = client.post("/auth/login", json={"email": "aluno@milton.edu.br", "password": "milton123"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["role"] == "student"
    assert body["grade"] == "9EF"
    assert "milton_session" in r.cookies


def test_teacher_login_returns_teacher_role(client: httpx.Client):
    r = client.post("/auth/login", json={"email": "professor@milton.edu.br", "password": "milton123"})
    assert r.status_code == 200, r.text
    assert r.json()["role"] == "teacher"


def test_manager_login_returns_manager_role(client: httpx.Client):
    r = client.post("/auth/login", json={"email": "gestor@milton.edu.br", "password": "milton123"})
    assert r.status_code == 200, r.text
    assert r.json()["role"] == "manager"


def test_wrong_password_is_rejected(client: httpx.Client):
    r = client.post("/auth/login", json={"email": "aluno@milton.edu.br", "password": "wrong-pass"})
    assert r.status_code in (400, 401), r.text


def test_school_name_is_milton(client: httpx.Client):
    r = client.get("/school")
    assert r.status_code == 200
    assert r.json()["name"] == "E.E. Milton Leme do Prado"

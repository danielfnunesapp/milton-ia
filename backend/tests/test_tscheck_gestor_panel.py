"""Criterion: Painel do Gestor — dashboard KPIs, create/delete users and classes, edit school name (restored)."""
import httpx

from tests.conftest import api_url


def _login(client: httpx.Client, email: str, password: str = "milton123"):
    r = client.post("/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return r


def test_admin_dashboard_kpis():
    with httpx.Client(base_url=api_url(), timeout=30.0) as client:
        _login(client, "gestor@milton.edu.br")
        r = client.get("/admin/dashboard")
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["total_students"] >= 22
        assert body["total_classes"] >= 7


def test_admin_create_and_delete_user():
    with httpx.Client(base_url=api_url(), timeout=30.0) as client:
        _login(client, "gestor@milton.edu.br")
        payload = {
            "name": "tscheck Aluno Teste",
            "email": "tscheck-user-aluno@milton.edu.br",
            "password": "tscheck123",
            "role": "student",
            "grade": "9EF",
            "class_id": "c-9a",
        }
        r = client.post("/admin/users", json=payload)
        assert r.status_code == 200, r.text
        uid = r.json()["id"]
        try:
            lst = client.get("/admin/users")
            assert any(u["id"] == uid for u in lst.json())
        finally:
            dr = client.delete(f"/admin/users/{uid}")
            assert dr.status_code == 200, dr.text


def test_admin_create_and_delete_class():
    with httpx.Client(base_url=api_url(), timeout=30.0) as client:
        _login(client, "gestor@milton.edu.br")
        r = client.post("/admin/classes", json={"name": "tscheck Turma X", "grade": "6EF"})
        assert r.status_code == 200, r.text
        cid = r.json()["id"]
        try:
            lst = client.get("/classes")
            assert any(c["id"] == cid for c in lst.json())
        finally:
            dr = client.delete(f"/admin/classes/{cid}")
            assert dr.status_code == 200, dr.text


def test_admin_edit_school_name_and_restore():
    original = "E.E. Milton Leme do Prado"
    with httpx.Client(base_url=api_url(), timeout=30.0) as client:
        _login(client, "gestor@milton.edu.br")
        cur = client.get("/school")
        assert cur.status_code == 200
        assert cur.json()["name"] == original

        updated = client.put("/admin/school", json={
            "name": "tscheck Escola Temporaria",
            "logo_url": None,
            "city": cur.json()["city"],
            "diretoria": cur.json()["diretoria"],
        })
        assert updated.status_code == 200, updated.text
        assert updated.json()["name"] == "tscheck Escola Temporaria"

        restored = client.put("/admin/school", json={
            "name": original,
            "logo_url": cur.json().get("logo_url"),
            "city": cur.json()["city"],
            "diretoria": cur.json()["diretoria"],
        })
        assert restored.status_code == 200, restored.text
        assert restored.json()["name"] == original


def test_non_manager_cannot_create_user():
    with httpx.Client(base_url=api_url(), timeout=30.0) as client:
        _login(client, "professor@milton.edu.br")
        r = client.post("/admin/users", json={
            "name": "tscheck Should Fail", "email": "tscheck-fail@milton.edu.br",
            "password": "tscheck123", "role": "student",
        })
        assert r.status_code in (401, 403), r.text

"""Criterion: Mural + Central de Estudos — staff publish/delete, student filter/search/like/open XP."""
import httpx

from tests.conftest import api_url


def _login(client: httpx.Client, email: str, password: str = "milton123"):
    r = client.post("/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return r


def test_seeded_mural_and_materials_counts():
    with httpx.Client(base_url=api_url(), timeout=30.0) as client:
        _login(client, "aluno@milton.edu.br")
        r = client.get("/mural")
        assert r.status_code == 200
        assert len(r.json()) >= 5
        r2 = client.get("/materials")
        assert r2.status_code == 200
        assert len(r2.json()) >= 9


def test_materials_search_filters_enem():
    with httpx.Client(base_url=api_url(), timeout=30.0) as client:
        _login(client, "aluno@milton.edu.br")
        r = client.get("/materials", params={"q": "enem"})
        assert r.status_code == 200, r.text
        items = r.json()
        assert len(items) > 0
        for it in items:
            blob = (it["title"] + it["description"]).lower()
            assert "enem" in blob


def test_teacher_publish_and_delete_material():
    with httpx.Client(base_url=api_url(), timeout=30.0) as client:
        _login(client, "professor@milton.edu.br")
        payload = {
            "title": "tscheck-material-xyz",
            "description": "material de teste criado pelo tscheck",
            "type": "link",
            "url": "https://example.com/tscheck",
        }
        r = client.post("/materials", json=payload)
        assert r.status_code == 200, r.text
        mid = r.json()["id"]
        try:
            lst = client.get("/materials", params={"q": "tscheck-material-xyz"})
            assert any(m["id"] == mid for m in lst.json())
        finally:
            dr = client.delete(f"/materials/{mid}")
            assert dr.status_code == 200, dr.text


def test_student_cannot_publish_material():
    with httpx.Client(base_url=api_url(), timeout=30.0) as client:
        _login(client, "aluno@milton.edu.br")
        r = client.post("/materials", json={
            "title": "tscheck-should-fail", "description": "x", "type": "link", "url": "https://example.com",
        })
        assert r.status_code in (401, 403), r.text


def test_teacher_publish_scheduled_mural_hidden_from_students():
    from datetime import datetime, timedelta, timezone
    with httpx.Client(base_url=api_url(), timeout=30.0) as teacher_client:
        _login(teacher_client, "professor@milton.edu.br")
        future = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
        payload = {
            "title": "tscheck-mural-scheduled",
            "description": "post agendado de teste",
            "category": "Atualidades",
            "media_type": "image",
            "media_url": "https://images.unsplash.com/photo-1501004318641-b39e6451bec6?w=400",
            "alt_text": "imagem de teste",
            "publish_at": future,
        }
        r = teacher_client.post("/mural", json=payload)
        assert r.status_code == 200, r.text
        post = r.json()
        pid = post["id"]
        assert post["scheduled"] is True
        try:
            staff_list = teacher_client.get("/mural")
            assert any(p["id"] == pid for p in staff_list.json())

            with httpx.Client(base_url=api_url(), timeout=30.0) as student_client:
                _login(student_client, "aluno@milton.edu.br")
                student_list = student_client.get("/mural")
                assert not any(p["id"] == pid for p in student_list.json())
        finally:
            dr = teacher_client.delete(f"/mural/{pid}")
            assert dr.status_code == 200, dr.text


def test_student_like_mural_post():
    with httpx.Client(base_url=api_url(), timeout=30.0) as teacher_client:
        _login(teacher_client, "professor@milton.edu.br")
        payload = {
            "title": "tscheck-mural-like",
            "description": "post de teste para like",
            "category": "Atualidades",
            "media_type": "image",
            "media_url": "https://images.unsplash.com/photo-1501004318641-b39e6451bec6?w=400",
            "alt_text": "imagem de teste",
        }
        r = teacher_client.post("/mural", json=payload)
        assert r.status_code == 200, r.text
        pid = r.json()["id"]
        try:
            with httpx.Client(base_url=api_url(), timeout=30.0) as student_client:
                _login(student_client, "aluno@milton.edu.br")
                lr = student_client.post(f"/mural/{pid}/like")
                assert lr.status_code == 200, lr.text
                assert lr.json()["likes"] >= 1
        finally:
            dr = teacher_client.delete(f"/mural/{pid}")
            assert dr.status_code == 200, dr.text

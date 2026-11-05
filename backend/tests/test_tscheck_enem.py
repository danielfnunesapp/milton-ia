"""Criterion: Missao ENEM start (timed simulado) + stats + redacao correction (5 competencias)."""
import httpx

from tests.conftest import api_url


def _login(client: httpx.Client, email: str, password: str = "milton123"):
    r = client.post("/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return r


def test_enem_start_returns_timed_questions():
    with httpx.Client(base_url=api_url(), timeout=90.0) as client:
        _login(client, "aluno@milton.edu.br")
        r = client.post("/enem/start", json={"area": "matematica", "count": 5})
        assert r.status_code == 200, r.text
        quiz = r.json()
        assert len(quiz["questions"]) == 5
        # 3 min/question countdown -> 15 min total for 5 questions
        assert quiz.get("time_limit_sec") == 5 * 180


def test_enem_stats_available_after_login():
    with httpx.Client(base_url=api_url(), timeout=30.0) as client:
        _login(client, "aluno@milton.edu.br")
        r = client.get("/enem/stats")
        assert r.status_code == 200, r.text
        body = r.json()
        assert "areas" in body and "plan" in body


def test_redacao_correction_returns_five_competencias():
    with httpx.Client(base_url=api_url(), timeout=90.0) as client:
        _login(client, "aluno@milton.edu.br")
        texto = (
            "A desigualdade social no Brasil contemporâneo ainda é um desafio estrutural que exige "
            "ações conjuntas do poder público e da sociedade civil. " * 4
        )
        assert len(texto) >= 200
        r = client.post("/enem/redacao", json={"tema": "Desigualdade social no Brasil", "texto": texto})
        assert r.status_code == 200, r.text
        body = r.json()
        assert len(body["competencias"]) == 5
        assert 0 <= body["nota_total"] <= 1000


def test_redacao_rejects_short_text():
    with httpx.Client(base_url=api_url(), timeout=30.0) as client:
        _login(client, "aluno@milton.edu.br")
        r = client.post("/enem/redacao", json={"tema": "Tema curto", "texto": "Texto muito curto."})
        assert r.status_code == 422, r.text

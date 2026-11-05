"""Criterion: Milton I.A Tutor chat streams a reply (SSE) and appears in sessions list."""
import httpx

from tests.conftest import api_url


def _login(client: httpx.Client, email: str, password: str = "milton123"):
    r = client.post("/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return r


def test_tutor_chat_streams_and_creates_session():
    with httpx.Client(base_url=api_url(), timeout=90.0) as client:
        _login(client, "aluno@milton.edu.br")
        events = []
        session_id = None
        full_text = ""
        with client.stream("POST", "/tutor/chat", json={
            "message": "tscheck: explique rapidamente o que é um número primo",
            "mode": "explicar",
        }) as r:
            assert r.status_code == 200, r.text
            event_name = None
            for line in r.iter_lines():
                if not line:
                    continue
                if line.startswith("event:"):
                    event_name = line.split(":", 1)[1].strip()
                elif line.startswith("data:"):
                    import json as _json
                    data = _json.loads(line.split(":", 1)[1].strip())
                    events.append((event_name, data))
                    if event_name == "session":
                        session_id = data.get("session_id")
                    if event_name == "delta":
                        full_text += data.get("text", "")
                    if event_name == "done":
                        break

        assert session_id, f"no session event received, events={events[:5]}"
        assert len(full_text) > 0, "no delta text streamed"

        r2 = client.get("/tutor/sessions")
        assert r2.status_code == 200, r2.text
        assert any(s["session_id"] == session_id for s in r2.json())

        r3 = client.get(f"/tutor/sessions/{session_id}")
        assert r3.status_code == 200, r3.text
        msgs = r3.json()
        assert any(m["role"] == "assistant" for m in msgs)

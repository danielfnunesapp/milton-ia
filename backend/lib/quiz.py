"""Shared quiz engine: public question view, attempt creation and grading."""

import random
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException

from lib.dates import today_iso
from lib.db import db
from lib.gamification import award_xp, compute_medals, level_info

MODES = {"rapido": (5, "Quiz Rápido", 10), "completo": (10, "Quiz Completo", 25), "master": (20, "Desafio Master", 60)}


def public_question(q: dict) -> dict:
    out = {"id": q["id"], "type": q["type"], "statement": q["statement"], "options": q.get("options", []), "left": [], "right": [],
           "image_url": q.get("image_url")}
    if q["type"] == "association":
        out["left"] = [p["left"] for p in q["pairs"]]
        out["right"] = random.sample([p["right"] for p in q["pairs"]], len(q["pairs"]))
    return out


async def save_questions(questions: list[dict], meta: dict) -> list[dict]:
    now = datetime.now(timezone.utc)
    docs = [{**q, **meta, "id": str(uuid.uuid4()), "created_at": now} for q in questions]
    if docs:
        await db.questions.insert_many([dict(d) for d in docs])
    return docs


async def topic_questions(topic: dict, n: int) -> list[dict]:
    """Random n questions for a curriculum topic; tops up the bank with AI-generated ones when short."""
    from lib.ai import generate_curriculum_questions
    from lib.curriculum import GRADE_LABEL
    bank = await db.questions.find({"topic_id": topic["id"]}, {"_id": 0}).to_list(500)
    if len(bank) < n:
        generated = await generate_curriculum_questions(topic, GRADE_LABEL[topic["grade"]], n - len(bank) + (2 if n > 5 else 0))
        bank += await save_questions(generated, {"scope": "curriculum", "topic_id": topic["id"], "grade": topic["grade"],
                                                 "subject": topic["subject"], "bimestre": topic["bimestre"],
                                                 "habilidade": topic["habilidade"], "source": "ai"})
    if not bank:
        raise HTTPException(503, "Não foi possível gerar questões agora. Tente novamente.")
    return random.sample(bank, min(n, len(bank)))


async def create_attempt(user: dict, questions: list[dict], **fields) -> dict:
    doc = {
        "id": str(uuid.uuid4()), "user_id": user["id"], "status": "open", "question_ids": [q["id"] for q in questions],
        "created_at": datetime.now(timezone.utc), "date": today_iso(), "grade": user.get("grade"),
        "class_id": user.get("class_id"), **fields,
    }
    await db.attempts.insert_one(dict(doc))
    return {**doc, "questions": [public_question(q) for q in questions]}


async def load_attempt(attempt_id: str, user: dict) -> tuple[dict, list[dict]]:
    att = await db.attempts.find_one({"id": attempt_id, "user_id": user["id"]}, {"_id": 0})
    if not att:
        raise HTTPException(404, "Tentativa não encontrada")
    qs = await db.questions.find({"id": {"$in": att["question_ids"]}}, {"_id": 0}).to_list(100)
    order = {qid: i for i, qid in enumerate(att["question_ids"])}
    qs.sort(key=lambda q: order[q["id"]])
    return att, qs


def _fmt(q: dict, ans) -> str:
    if q["type"] == "association":
        if not isinstance(ans, dict) or not ans:
            return "—"
        return "; ".join(f"{k} → {v}" for k, v in ans.items())
    return ans if isinstance(ans, str) and ans else "—"


def _check(q: dict, ans) -> bool:
    if q["type"] == "association":
        return isinstance(ans, dict) and all(ans.get(p["left"]) == p["right"] for p in q["pairs"])
    return isinstance(ans, str) and ans.strip().lower() == q["answer"].strip().lower()


def suggestions_for(score: int, att: dict) -> list[str]:
    topic = att.get("subtitle") or att.get("subject")
    if score < 50:
        return [f"Revise o objeto de conhecimento \"{topic}\" na Central de Estudos.",
                "Peça ao Milton I.A Tutor uma explicação passo a passo dos itens que você errou.",
                "Refaça o Quiz Rápido amanhã para fixar o conteúdo."]
    if score < 80:
        return ["Leia com atenção as correções comentadas das questões erradas.",
                "Tente o Quiz Completo para consolidar a habilidade.",
                "Use o modo 'Criar questões' do Tutor para treinar mais."]
    if score < 100:
        return ["Ótimo desempenho! Falta pouco para gabaritar.", "Encare o Desafio Master e ganhe XP extra."]
    return ["Gabaritou! 🏆 Avance para o próximo bimestre da trilha.", "Desafie seus colegas no ranking semanal."]


async def grade_attempt(att: dict, qs: list[dict], answers: dict, duration: int, user: dict, bonus: int) -> dict:
    if att["status"] == "done":
        raise HTTPException(409, "Esta atividade já foi finalizada")
    before = {m["id"] for m in (await compute_medals(user))[0] if m["unlocked"]}
    items, correct = [], 0
    for q in qs:
        ans = answers.get(q["id"])
        ok = _check(q, ans)
        correct += ok
        expected = "; ".join(f"{p['left']} → {p['right']}" for p in q["pairs"]) if q["type"] == "association" else q["answer"]
        items.append({"question_id": q["id"], "type": q["type"], "statement": q["statement"], "your_answer": _fmt(q, ans),
                      "correct_answer": expected, "is_correct": ok, "explanation": q.get("explanation", ""),
                      "image_url": q.get("image_url")})
    total = len(qs)
    score = round(100 * correct / total) if total else 0
    xp = await award_xp(user, correct * 10 + bonus, att["title"])
    await db.attempts.update_one({"id": att["id"]}, {"$set": {
        "status": "done", "correct": correct, "total": total, "score": score, "xp": xp,
        "duration_sec": max(0, duration), "finished_at": datetime.now(timezone.utc), "date": today_iso()}})
    medals, ach, _ = await compute_medals(user)
    new = [m for m in medals + ach if m["unlocked"] and m["id"] not in before]
    return {"attempt_id": att["id"], "title": att["title"], "correct": correct, "wrong": total - correct, "total": total,
            "score": score, "xp_earned": xp, "items": items, "suggestions": suggestions_for(score, att), "new_medals": new,
            "xp": user["xp"], "level": level_info(user["xp"])["level"], "streak": user.get("streak", 0)}

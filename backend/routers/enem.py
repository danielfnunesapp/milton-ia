import random
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from lib.ai import correct_essay, generate_enem_questions
from lib.auth import current_user
from lib.curriculum import ENEM_AREAS
from lib.db import db
from lib.gamification import award_xp
from lib.quiz import create_attempt, save_questions
from models.schemas import Attempt, EnemStartIn, EnemStats, Essay, EssayIn

router = APIRouter(prefix="/enem")

SEC_PER_QUESTION = 180


@router.post("/start", response_model=Attempt)
async def start(body: EnemStartIn, user: dict = Depends(current_user)):
    label = ENEM_AREAS[body.area]
    bank = await db.questions.find({"scope": "enem", "area": body.area}, {"_id": 0}).to_list(1000)
    seen = set()
    async for a in db.attempts.find({"user_id": user["id"], "kind": "enem", "area": body.area}, {"question_ids": 1}):
        seen.update(a["question_ids"])
    fresh = [q for q in bank if q["id"] not in seen]
    if len(fresh) < body.count:
        gen = await generate_enem_questions(label, body.count - len(fresh))
        fresh += await save_questions(gen, {"scope": "enem", "area": body.area, "subject": label, "source": "ai"})
    pool = fresh if len(fresh) >= body.count else fresh + [q for q in bank if q not in fresh]
    if not pool:
        raise HTTPException(503, "Não foi possível montar o simulado agora. Tente novamente.")
    qs = random.sample(pool, min(body.count, len(pool)))
    att = await create_attempt(user, qs, kind="enem", title=f"Simulado ENEM · {label}", subtitle=f"{len(qs)} questões",
                               subject=label, area=body.area, mode=f"enem{body.count}", topic_id=None,
                               time_limit_sec=len(qs) * SEC_PER_QUESTION)
    return Attempt(**att)


@router.get("/stats", response_model=EnemStats)
async def stats(user: dict = Depends(current_user)):
    rows = await db.attempts.aggregate([
        {"$match": {"user_id": user["id"], "kind": "enem", "status": "done"}},
        {"$group": {"_id": "$area", "c": {"$sum": "$correct"}, "t": {"$sum": "$total"}, "n": {"$sum": 1}, "s": {"$avg": "$score"}}},
    ]).to_list(10)
    by = {r["_id"]: r for r in rows}
    areas = [{"area": k, "label": v, "accuracy": round(100 * by[k]["c"] / by[k]["t"]) if k in by and by[k]["t"] else 0,
              "attempts": by.get(k, {}).get("n", 0), "answered": by.get(k, {}).get("t", 0)} for k, v in ENEM_AREAS.items()]
    total_n = sum(a["attempts"] for a in areas)
    avg = round(sum(r["s"] * r["n"] for r in rows) / total_n) if total_n else 0
    best = await db.essays.find({"user_id": user["id"]}, {"nota_total": 1}).sort("nota_total", -1).to_list(1)
    weak = sorted(areas, key=lambda a: (a["attempts"] > 0, a["accuracy"]))
    days = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"]
    plan = [f"{days[i]}: 1 simulado de 10 questões de {a['label']}" + (" (prioridade — área com menor desempenho)" if i == 0 else "")
            for i, a in enumerate(weak)]
    plan.append("Sexta: escreva uma redação e envie para correção do Milton I.A")
    plan.append("Sábado: revise as correções comentadas e peça ao Tutor um mapa mental dos erros")
    return EnemStats(areas=areas, simulados=total_n, avg_score=avg, best_essay=best[0]["nota_total"] if best else None, plan=plan)


@router.post("/redacao", response_model=Essay)
async def redacao(body: EssayIn, user: dict = Depends(current_user)):
    try:
        result = await correct_essay(body.tema, body.texto)
    except Exception:
        raise HTTPException(503, "Não foi possível corrigir agora. Tente novamente em instantes.")
    doc = {"id": str(uuid.uuid4()), "user_id": user["id"], "tema": body.tema, "texto": body.texto, **result,
           "created_at": datetime.now(timezone.utc)}
    await db.essays.insert_one(dict(doc))
    await award_xp(user, 30, "Redação ENEM")
    return Essay(**doc)


@router.get("/redacoes", response_model=list[Essay])
async def redacoes(user: dict = Depends(current_user)):
    docs = await db.essays.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return [Essay(**{**d, "created_at": d["created_at"].replace(tzinfo=timezone.utc)}) for d in docs]

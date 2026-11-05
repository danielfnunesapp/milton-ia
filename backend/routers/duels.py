import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException

from lib.auth import require_roles
from lib.curriculum import find_topic
from lib.db import db
from lib.duels import DUEL_BONUS, DUEL_HOURS, _utc, expire_duels
from lib.quiz import create_attempt, topic_questions
from models.schemas import Attempt, Duel, DuelIn, Opponent

router = APIRouter(prefix="/duels")
student_only = require_roles("student")
DUEL_SIZE = 5


def _view(d: dict, uid: str, names: dict) -> Duel:
    side = "challenger" if d["challenger_id"] == uid else "opponent"
    other = "opponent" if side == "challenger" else "challenger"
    finished = d["status"] in ("done", "expired")
    my_score = d.get(f"{side}_score")
    return Duel(
        id=d["id"], subject=d["subject"], topic_label=d["topic_label"],
        challenger_name=names.get(d["challenger_id"], "—"), opponent_name=names.get(d["opponent_id"], "—"),
        my_side=side, status=d["status"], total=len(d["question_ids"]), my_score=my_score,
        their_score=d.get(f"{other}_score") if finished or my_score is not None else None,
        winner_name=names.get(d.get("winner_id") or "") if finished else None,
        i_won=finished and d.get("winner_id") == uid, my_attempt_id=d.get(f"{side}_attempt_id"),
        my_done=my_score is not None, can_accept=side == "opponent" and d["status"] == "pending",
        bonus_xp=DUEL_BONUS, expires_at=_utc(d["expires_at"]), created_at=_utc(d["created_at"]),
    )


async def _names(ds: list[dict]) -> dict:
    ids = {i for d in ds for i in (d["challenger_id"], d["opponent_id"])}
    return {u["id"]: u["name"] async for u in db.users.find({"id": {"$in": list(ids)}}, {"id": 1, "name": 1})}


@router.get("/opponents", response_model=list[Opponent])
async def opponents(user: dict = Depends(student_only)):
    classes = {c["id"]: c["name"] for c in await db.classes.find({}, {"_id": 0}).to_list(1000)}
    docs = await db.users.find({"role": "student", "grade": user.get("grade"), "id": {"$ne": user["id"]}},
                               {"_id": 0, "password_hash": 0}).to_list(500)
    docs.sort(key=lambda u: (u.get("class_id") != user.get("class_id"), u["name"]))
    return [Opponent(id=u["id"], name=u["name"], class_name=classes.get(u.get("class_id") or ""), avatar_color=u.get("avatar_color", "#6366F1")) for u in docs]


@router.get("", response_model=list[Duel])
async def list_duels(user: dict = Depends(student_only)):
    await expire_duels(user["id"])
    ds = await db.duels.find({"$or": [{"challenger_id": user["id"]}, {"opponent_id": user["id"]}]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    names = await _names(ds)
    return [_view(d, user["id"], names) for d in ds]


@router.post("", response_model=Attempt)
async def create_duel(body: DuelIn, user: dict = Depends(student_only)):
    opp = await db.users.find_one({"id": body.opponent_id, "role": "student"}, {"_id": 0})
    if not opp or opp["id"] == user["id"]:
        raise HTTPException(404, "Colega não encontrado")
    topic = find_topic(body.topic_id)
    if not topic:
        raise HTTPException(404, "Tópico não encontrado")
    qs = await topic_questions(topic, DUEL_SIZE)
    now = datetime.now(timezone.utc)
    duel_id = str(uuid.uuid4())
    att = await create_attempt(user, qs, kind="duel", duel_id=duel_id, title=f"Duelo · {topic['subject']}",
                               subtitle=f"vs {opp['name']} · {topic['objeto']}", subject=topic["subject"], mode="duel",
                               topic_id=topic["id"], time_limit_sec=None)
    await db.duels.insert_one({
        "id": duel_id, "challenger_id": user["id"], "opponent_id": opp["id"], "topic_id": topic["id"], "subject": topic["subject"],
        "topic_label": f"{topic['habilidade']} · {topic['objeto']}", "question_ids": [q["id"] for q in qs], "status": "pending",
        "challenger_attempt_id": att["id"], "opponent_attempt_id": None, "challenger_score": None, "opponent_score": None,
        "winner_id": None, "created_at": now, "expires_at": now + timedelta(hours=DUEL_HOURS),
    })
    return Attempt(**att)


@router.post("/{duel_id}/accept", response_model=Attempt)
async def accept(duel_id: str, user: dict = Depends(student_only)):
    await expire_duels(user["id"])
    d = await db.duels.find_one({"id": duel_id, "opponent_id": user["id"]}, {"_id": 0})
    if not d:
        raise HTTPException(404, "Duelo não encontrado")
    if d["status"] != "pending":
        raise HTTPException(409, "Este duelo não está mais disponível")
    challenger = await db.users.find_one({"id": d["challenger_id"]}, {"name": 1})
    qs = await db.questions.find({"id": {"$in": d["question_ids"]}}, {"_id": 0}).to_list(50)
    order = {qid: i for i, qid in enumerate(d["question_ids"])}
    qs.sort(key=lambda q: order[q["id"]])
    att = await create_attempt(user, qs, kind="duel", duel_id=duel_id, title=f"Duelo · {d['subject']}",
                               subtitle=f"vs {challenger['name'] if challenger else 'colega'} · {d['topic_label']}",
                               subject=d["subject"], mode="duel", topic_id=d["topic_id"], time_limit_sec=None)
    await db.duels.update_one({"id": duel_id}, {"$set": {"status": "active", "opponent_attempt_id": att["id"]}})
    return Attempt(**att)


@router.post("/{duel_id}/decline")
async def decline(duel_id: str, user: dict = Depends(student_only)):
    r = await db.duels.update_one({"id": duel_id, "opponent_id": user["id"], "status": "pending"}, {"$set": {"status": "declined"}})
    if not r.modified_count:
        raise HTTPException(404, "Duelo não encontrado")
    return {"ok": True}

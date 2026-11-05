from fastapi import APIRouter, Depends

from lib.auth import require_roles
from lib.db import db
from lib.gamification import compute_medals, days_ago, level_info
from models.schemas import ChildSummary

router = APIRouter(prefix="/family")
guardian_only = require_roles("guardian")


async def _subject_stats(uid: str, since: str) -> list[dict]:
    rows = await db.attempts.aggregate([
        {"$match": {"user_id": uid, "status": "done", "date": {"$gte": since}}},
        {"$group": {"_id": "$subject", "c": {"$sum": "$correct"}, "t": {"$sum": "$total"}, "n": {"$sum": 1}}},
    ]).to_list(50)
    return [{"subject": r["_id"], "accuracy": round(100 * r["c"] / r["t"]) if r["t"] else 0, "attempts": r["n"], "correct": r["c"]} for r in rows if r["_id"]]


@router.get("/summary", response_model=list[ChildSummary])
async def summary(user: dict = Depends(guardian_only)):
    kids = await db.users.find({"id": {"$in": user.get("children_ids", [])}, "role": "student"}, {"_id": 0, "password_hash": 0}).to_list(20)
    classes = {c["id"]: c["name"] for c in await db.classes.find({}, {"_id": 0}).to_list(1000)}
    week, prev = days_ago(6), days_ago(13)
    out = []
    for k in kids:
        ev = await db.xp_events.aggregate([{"$match": {"user_id": k["id"], "date": {"$gte": prev}}},
                                           {"$group": {"_id": "$date", "xp": {"$sum": "$amount"}}}]).to_list(30)
        by_day = {r["_id"]: r["xp"] for r in ev}
        daily = [{"date": days_ago(i), "xp": by_day.get(days_ago(i), 0)} for i in range(6, -1, -1)]
        wk = await db.attempts.aggregate([{"$match": {"user_id": k["id"], "status": "done", "date": {"$gte": week}}},
                                          {"$group": {"_id": None, "n": {"$sum": 1}, "avg": {"$avg": "$score"}, "dur": {"$sum": "$duration_sec"}}}]).to_list(1)
        stats = await _subject_stats(k["id"], days_ago(29))
        medals, ach, _ = await compute_medals(k)
        won = await db.duels.count_documents({"winner_id": k["id"], "finished_at": {"$exists": True}, "status": {"$in": ["done", "expired"]}})
        out.append(ChildSummary(
            id=k["id"], name=k["name"], grade=k.get("grade"), class_name=classes.get(k.get("class_id") or ""),
            avatar_color=k.get("avatar_color", "#6366F1"), **{kk: v for kk, v in level_info(k.get("xp", 0)).items() if kk in ("level", "level_name")},
            xp=k.get("xp", 0), xp_week=sum(d["xp"] for d in daily),
            xp_prev_week=sum(v for d, v in by_day.items() if d < week), streak=k.get("streak", 0), best_streak=k.get("best_streak", 0),
            active_days_week=sum(1 for d in daily if d["xp"] > 0), quizzes_week=wk[0]["n"] if wk else 0,
            avg_score_week=round(wk[0]["avg"]) if wk and wk[0]["avg"] is not None else None,
            study_minutes_week=round((wk[0]["dur"] if wk else 0) / 60), daily=daily,
            attention=sorted([s for s in stats if s["accuracy"] < 60], key=lambda s: s["accuracy"]),
            strengths=sorted([s for s in stats if s["accuracy"] >= 70], key=lambda s: -s["accuracy"])[:3],
            medals_unlocked=sum(m["unlocked"] for m in medals + ach), medals_total=len(medals + ach), duels_won_week=won,
        ))
    return out

"""XP, níveis, sequência (streak), medalhas e rankings."""

from datetime import date, datetime, timedelta, timezone

from lib.curriculum import SCIENCE_SUBJECTS
from lib.dates import today_iso
from lib.db import db

LEVEL_XP = 300
LEVEL_NAMES = ["Iniciante", "Aprendiz", "Explorador", "Investigador", "Cientista", "Pesquisador", "Sábio", "Mestre", "Lenda"]


def level_info(xp: int) -> dict:
    lvl = xp // LEVEL_XP + 1
    return {"level": lvl, "level_name": LEVEL_NAMES[min(lvl - 1, len(LEVEL_NAMES) - 1)],
            "xp_into_level": xp % LEVEL_XP, "xp_for_next": LEVEL_XP}


def days_ago(n: int) -> str:
    return (date.fromisoformat(today_iso()) - timedelta(days=n)).isoformat()


async def award_xp(user: dict, amount: int, reason: str) -> int:
    """Credits XP, updates the daily streak; first activity of the day earns +5 participation bonus."""
    today = today_iso()
    now = datetime.now(timezone.utc)
    total = amount
    updates: dict = {}
    if user.get("last_active_date") != today:
        streak = user.get("streak", 0) + 1 if user.get("last_active_date") == days_ago(1) else 1
        updates = {"streak": streak, "best_streak": max(user.get("best_streak", 0), streak), "last_active_date": today}
        await db.xp_events.insert_one({"user_id": user["id"], "amount": 5, "reason": "Participação diária", "date": today, "created_at": now})
        total += 5
    if amount:
        await db.xp_events.insert_one({"user_id": user["id"], "amount": amount, "reason": reason, "date": today, "created_at": now})
    await db.users.update_one({"id": user["id"]}, {"$inc": {"xp": total}, **({"$set": updates} if updates else {})})
    user.update(updates)
    user["xp"] = user.get("xp", 0) + total
    return total


MEDALS = [
    ("aprendiz", "Aprendiz", "🥉", "Complete seu primeiro quiz"),
    ("explorador", "Explorador", "🥈", "Complete 10 quizzes"),
    ("cientista", "Cientista", "🥇", "Alcance 1.000 XP"),
    ("mestre", "Mestre do Conhecimento", "🏆", "Alcance 5.000 XP"),
    ("especialista_mat", "Especialista em Matemática", "🎯", "Acerte 50 questões de Matemática"),
    ("leitor", "Leitor Nota 10", "📖", "Gabarite um quiz de Língua Portuguesa"),
    ("pesquisador", "Jovem Pesquisador", "🔬", "Acerte 30 questões de Ciências da Natureza"),
]
ACHIEVEMENTS = [
    ("streak7", "7 dias seguidos", "🔥", "Estude 7 dias seguidos"),
    ("streak15", "15 dias seguidos", "⚡", "Estude 15 dias seguidos"),
    ("streak30", "30 dias seguidos", "💎", "Estude 30 dias seguidos"),
    ("enem1", "Rumo ao ENEM", "🎓", "Conclua um simulado da Missão ENEM"),
    ("redator", "Redator", "✍️", "Envie uma redação para correção"),
]


async def user_stats(user_id: str) -> dict:
    rows = await db.attempts.aggregate([
        {"$match": {"user_id": user_id, "status": "done"}},
        {"$group": {"_id": "$subject", "correct": {"$sum": "$correct"}, "total": {"$sum": "$total"},
                    "attempts": {"$sum": 1}, "perfect": {"$sum": {"$cond": [{"$eq": ["$score", 100]}, 1, 0]}},
                    "enem": {"$sum": {"$cond": [{"$eq": ["$kind", "enem"]}, 1, 0]}}}},
    ]).to_list(100)
    by = {r["_id"]: r for r in rows}
    return {
        "quizzes": sum(r["attempts"] for r in rows),
        "by_subject": by,
        "mat": by.get("Matemática", {}).get("correct", 0),
        "lp_perfect": by.get("Língua Portuguesa", {}).get("perfect", 0),
        "sci": sum(r["correct"] for s, r in by.items() if s in SCIENCE_SUBJECTS),
        "enem": sum(r["enem"] for r in rows),
        "essays": await db.essays.count_documents({"user_id": user_id}),
    }


def _m(mid, name, emoji, desc, p):
    p = max(0.0, min(1.0, p))
    return {"id": mid, "name": name, "emoji": emoji, "description": desc, "progress": round(p, 2), "unlocked": p >= 1}


async def compute_medals(user: dict) -> tuple[list[dict], list[dict], dict]:
    s = await user_stats(user["id"])
    xp, best = user.get("xp", 0), max(user.get("best_streak", 0), user.get("streak", 0))
    prog = {"aprendiz": s["quizzes"] / 1, "explorador": s["quizzes"] / 10, "cientista": xp / 1000, "mestre": xp / 5000,
            "especialista_mat": s["mat"] / 50, "leitor": float(s["lp_perfect"] >= 1), "pesquisador": s["sci"] / 30,
            "streak7": best / 7, "streak15": best / 15, "streak30": best / 30, "enem1": float(s["enem"] >= 1),
            "redator": float(s["essays"] >= 1)}
    medals = [_m(*m, prog[m[0]]) for m in MEDALS]
    ach = [_m(*a, prog[a[0]]) for a in ACHIEVEMENTS]
    return medals, ach, s


PERIOD_DAYS = {"daily": 0, "weekly": 6, "monthly": 29}


async def ranking(period: str, scope: str, user: dict) -> list[dict]:
    q: dict = {"role": "student"}
    if scope == "class" and user.get("class_id"):
        q["class_id"] = user["class_id"]
    students = await db.users.find(q, {"_id": 0, "password_hash": 0}).to_list(10000)
    classes = {c["id"]: c["name"] for c in await db.classes.find({}, {"_id": 0}).to_list(1000)}
    if period in PERIOD_DAYS:
        ids = [s["id"] for s in students]
        rows = await db.xp_events.aggregate([
            {"$match": {"user_id": {"$in": ids}, "date": {"$gte": days_ago(PERIOD_DAYS[period])}}},
            {"$group": {"_id": "$user_id", "xp": {"$sum": "$amount"}}},
        ]).to_list(10000)
        xp_map = {r["_id"]: r["xp"] for r in rows}
    else:
        xp_map = {s["id"]: s.get("xp", 0) for s in students}
    students.sort(key=lambda s: (-xp_map.get(s["id"], 0), s["name"]))
    return [
        {"position": i + 1, "user_id": s["id"], "name": s["name"], "grade": s.get("grade"),
         "class_name": classes.get(s.get("class_id") or "", None), "xp": xp_map.get(s["id"], 0),
         "avatar_color": s.get("avatar_color", "#6366F1"), "is_me": s["id"] == user["id"]}
        for i, s in enumerate(students)
    ]

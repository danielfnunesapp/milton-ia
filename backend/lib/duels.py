"""Duelo entre colegas (assíncrono, 24h): mesmas 5 questões, vence quem acerta mais (desempate: menor tempo)."""

from datetime import datetime, timezone

from lib.db import db
from lib.gamification import award_xp

DUEL_BONUS = 50
DUEL_HOURS = 24


def _utc(d: datetime) -> datetime:
    return d.replace(tzinfo=timezone.utc) if d.tzinfo is None else d


async def _pay_winner(winner_id: str | None) -> None:
    if winner_id:
        w = await db.users.find_one({"id": winner_id}, {"_id": 0, "password_hash": 0})
        if w:
            await award_xp(w, DUEL_BONUS, "Vitória em duelo")


def _decide(d: dict) -> str | None:
    c, o = d["challenger_score"], d["opponent_score"]
    if c != o:
        return d["challenger_id"] if c > o else d["opponent_id"]
    ct, ot = d.get("challenger_time") or 0, d.get("opponent_time") or 0
    if ct != ot:
        return d["challenger_id"] if ct < ot else d["opponent_id"]
    return None


async def on_duel_submit(att: dict, res: dict, duration: int, user: dict) -> str:
    d = await db.duels.find_one({"id": att.get("duel_id")}, {"_id": 0})
    if not d:
        return "Duelo registrado."
    side = "challenger" if d["challenger_id"] == user["id"] else "opponent"
    upd = {f"{side}_score": res["correct"], f"{side}_time": max(0, duration)}
    d.update(upd)
    if d.get("challenger_score") is not None and d.get("opponent_score") is not None and d["status"] in ("pending", "active"):
        winner = _decide(d)
        upd.update(status="done", winner_id=winner, finished_at=datetime.now(timezone.utc))
        await db.duels.update_one({"id": d["id"]}, {"$set": upd})
        await _pay_winner(winner)
        if winner == user["id"]:
            res["xp"] += DUEL_BONUS
            res["xp_earned"] += DUEL_BONUS
            return f"⚔️ Você venceu o duelo! +{DUEL_BONUS} XP de bônus."
        return "⚔️ Duelo encerrado: empate!" if winner is None else "⚔️ Seu colega venceu este duelo — revanche?"
    await db.duels.update_one({"id": d["id"]}, {"$set": upd})
    return "⚔️ Resultado enviado! Aguardando seu colega responder (até 24h)."


async def expire_duels(user_id: str) -> None:
    now = datetime.now(timezone.utc)
    q = {"$or": [{"challenger_id": user_id}, {"opponent_id": user_id}], "status": {"$in": ["pending", "active"]}, "expires_at": {"$lt": now}}
    async for d in db.duels.find(q, {"_id": 0}):
        winner = None
        if d.get("challenger_score") is not None and d.get("opponent_score") is None:
            winner = d["challenger_id"]
        elif d.get("opponent_score") is not None and d.get("challenger_score") is None:
            winner = d["opponent_id"]
        r = await db.duels.update_one({"id": d["id"], "status": d["status"]}, {"$set": {"status": "expired", "winner_id": winner, "finished_at": now}})
        if r.modified_count:
            await _pay_winner(winner)

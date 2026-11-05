import json
import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from emergentintegrations.llm.chat import StreamDone, TextDelta, UserMessage

from lib.ai import new_chat, tutor_system
from lib.auth import current_user
from lib.curriculum import GRADE_LABEL
from lib.db import db
from models.schemas import TutorChatIn, TutorMessage, TutorSession

router = APIRouter(prefix="/tutor")
logger = logging.getLogger(__name__)


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


@router.post("/chat")
async def chat(body: TutorChatIn, user: dict = Depends(current_user)):
    sid = body.session_id or str(uuid.uuid4())
    history = await db.tutor_messages.find({"session_id": sid, "user_id": user["id"]}, {"_id": 0}).sort("created_at", 1).to_list(30)
    now = datetime.now(timezone.utc)
    await db.tutor_messages.insert_one({"session_id": sid, "user_id": user["id"], "role": "user", "content": body.message, "created_at": now})
    await db.tutor_sessions.update_one(
        {"session_id": sid, "user_id": user["id"]},
        {"$set": {"updated_at": now}, "$setOnInsert": {"title": body.message[:60], "session_id": sid, "user_id": user["id"]}},
        upsert=True,
    )
    grade_label = GRADE_LABEL.get(user.get("grade") or "", "Ensino Fundamental ou Médio")
    llm = new_chat(tutor_system(grade_label, body.mode, user["name"].split()[0]),
                   [{"role": m["role"], "content": m["content"]} for m in history])

    async def gen():
        yield _sse("session", {"session_id": sid})
        parts: list[str] = []
        try:
            async for ev in llm.stream_message(UserMessage(text=body.message)):
                if isinstance(ev, TextDelta):
                    parts.append(ev.content)
                    yield _sse("delta", {"text": ev.content})
                elif isinstance(ev, StreamDone):
                    break
        except Exception as exc:
            logger.error("tutor stream failed: %s", exc)
            yield _sse("error", {"message": "O Milton I.A está indisponível no momento. Tente de novo."})
        if parts:
            await db.tutor_messages.insert_one({"session_id": sid, "user_id": user["id"], "role": "assistant",
                                                "content": "".join(parts), "created_at": datetime.now(timezone.utc)})
        yield _sse("done", {})

    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@router.get("/sessions", response_model=list[TutorSession])
async def sessions(user: dict = Depends(current_user)):
    docs = await db.tutor_sessions.find({"user_id": user["id"]}, {"_id": 0}).sort("updated_at", -1).to_list(30)
    return [TutorSession(**{**d, "updated_at": d["updated_at"].replace(tzinfo=timezone.utc)}) for d in docs]


@router.get("/sessions/{sid}", response_model=list[TutorMessage])
async def messages(sid: str, user: dict = Depends(current_user)):
    docs = await db.tutor_messages.find({"session_id": sid, "user_id": user["id"]}, {"_id": 0}).sort("created_at", 1).to_list(200)
    if not docs:
        raise HTTPException(404, "Conversa não encontrada")
    return [TutorMessage(**{**d, "created_at": d["created_at"].replace(tzinfo=timezone.utc)}) for d in docs]

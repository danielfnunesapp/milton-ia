import os
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, Request, Response
from passlib.hash import pbkdf2_sha256

from lib.dates import today_iso
from lib.db import db

COOKIE = "milton_session"
SECRET = os.environ.get("JWT_SECRET", "milton-dev-secret")


def hash_password(p: str) -> str:
    return pbkdf2_sha256.hash(p)


def verify_password(p: str, h: str) -> bool:
    try:
        return pbkdf2_sha256.verify(p, h)
    except Exception:
        return False


def set_session(resp: Response, user_id: str) -> None:
    token = jwt.encode({"sub": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=7)}, SECRET, algorithm="HS256")
    resp.set_cookie(COOKIE, token, httponly=True, samesite="lax", max_age=7 * 86400, path="/")


async def log_access(user_id: str) -> None:
    await db.access_log.update_one({"user_id": user_id, "date": today_iso()}, {"$setOnInsert": {"user_id": user_id, "date": today_iso()}}, upsert=True)


async def current_user(request: Request) -> dict:
    token = request.cookies.get(COOKIE)
    if not token:
        raise HTTPException(401, "Não autenticado")
    try:
        uid = jwt.decode(token, SECRET, algorithms=["HS256"])["sub"]
    except Exception:
        raise HTTPException(401, "Sessão inválida")
    user = await db.users.find_one({"id": uid}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(401, "Usuário não encontrado")
    return user


def require_roles(*roles: str):
    async def dep(user: dict = Depends(current_user)) -> dict:
        if user["role"] not in roles:
            raise HTTPException(403, "Acesso restrito")
        return user
    return dep


staff_only = require_roles("teacher", "manager")
manager_only = require_roles("manager")

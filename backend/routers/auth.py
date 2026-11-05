from fastapi import APIRouter, Depends, HTTPException, Response

from lib.auth import COOKIE, current_user, log_access, set_session, verify_password
from lib.db import db
from models.schemas import LoginIn, School, User

router = APIRouter()

DEFAULT_SCHOOL = {"name": "E.E. Prof. Milton Leme do Prado", "logo_url": "/logo-milton.png", "city": "São Paulo - SP", "diretoria": "Programa Ensino Integral"}


@router.get("/school", response_model=School)
async def get_school():
    doc = await db.settings.find_one({"key": "school"}, {"_id": 0})
    return School(**(doc or DEFAULT_SCHOOL))


@router.post("/auth/login", response_model=User)
async def login(body: LoginIn, response: Response):
    doc = await db.users.find_one({"email": body.email.strip().lower()}, {"_id": 0})
    if not doc or not verify_password(body.password, doc.get("password_hash", "")):
        raise HTTPException(401, "E-mail ou senha inválidos")
    set_session(response, doc["id"])
    await log_access(doc["id"])
    return User(**doc)


@router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie(COOKIE, path="/")
    return {"ok": True}


@router.get("/auth/me", response_model=User)
async def me(user: dict = Depends(current_user)):
    await log_access(user["id"])
    return User(**user)

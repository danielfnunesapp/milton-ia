import re
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse

from lib.auth import current_user, staff_only
from lib.db import db
from lib.gamification import award_xp
from lib.storage import UPLOAD_DIR
from models.schemas import Material, MaterialIn, MuralIn, MuralPost, UploadOut, ViewIn, XpOut

router = APIRouter()
ALLOWED = {"jpg", "jpeg", "png", "webp", "gif", "mp4", "webm", "mov", "pdf", "ppt", "pptx", "doc", "docx"}
MAX_BYTES = 60 * 1024 * 1024


def _utc(d: datetime) -> datetime:
    return d.replace(tzinfo=timezone.utc) if d.tzinfo is None else d


@router.post("/uploads", response_model=UploadOut)
async def upload(file: UploadFile = File(...), user: dict = Depends(staff_only)):
    ext = (file.filename or "").rsplit(".", 1)[-1].lower()
    if ext not in ALLOWED:
        raise HTTPException(400, "Formato não suportado")
    name = f"{uuid.uuid4().hex}.{ext}"
    size = 0
    with open(UPLOAD_DIR / name, "wb") as f:
        while chunk := await file.read(1024 * 1024):
            size += len(chunk)
            if size > MAX_BYTES:
                f.close()
                (UPLOAD_DIR / name).unlink(missing_ok=True)
                raise HTTPException(413, "Arquivo muito grande (máx. 60 MB)")
            f.write(chunk)
    return UploadOut(url=f"/api/files/{name}", filename=file.filename or name, content_type=file.content_type or "")


@router.get("/files/{name}")
async def get_file(name: str):
    path = UPLOAD_DIR / Path(name).name
    if not path.exists():
        raise HTTPException(404, "Arquivo não encontrado")
    return FileResponse(path)


# ---------- Central de Estudos ----------
@router.get("/materials", response_model=list[Material])
async def materials(q: str = "", type: str = "", grade: str = "", subject: str = "", user: dict = Depends(current_user)):
    f: dict = {}
    if q.strip():
        rx = {"$regex": re.escape(q.strip()), "$options": "i"}
        f["$or"] = [{"title": rx}, {"description": rx}, {"subject": rx}]
    if type:
        f["type"] = type
    if grade:
        f["grade"] = {"$in": [grade, None]}
    if subject:
        f["subject"] = subject
    docs = await db.materials.find(f, {"_id": 0}).sort("created_at", -1).to_list(500)
    return [Material(**{**d, "created_at": _utc(d["created_at"])}) for d in docs]


@router.post("/materials", response_model=Material)
async def create_material(body: MaterialIn, user: dict = Depends(staff_only)):
    doc = {**body.model_dump(), "id": str(uuid.uuid4()), "created_by_name": user["name"], "created_at": datetime.now(timezone.utc)}
    await db.materials.insert_one(dict(doc))
    return Material(**doc)


@router.delete("/materials/{mid}")
async def delete_material(mid: str, user: dict = Depends(staff_only)):
    r = await db.materials.delete_one({"id": mid})
    if not r.deleted_count:
        raise HTTPException(404, "Material não encontrado")
    return {"ok": True}


# ---------- Mural Milton I.A ----------
def _post(d: dict, uid: str) -> MuralPost:
    pa = _utc(d["publish_at"])
    return MuralPost(**{**d, "publish_at": pa, "scheduled": pa > datetime.now(timezone.utc),
                        "likes": len(d.get("liked_by", [])), "liked": uid in d.get("liked_by", [])})


@router.get("/mural", response_model=list[MuralPost])
async def mural(category: str = "", user: dict = Depends(current_user)):
    f: dict = {}
    if category:
        f["category"] = category
    if user["role"] == "student":
        f["publish_at"] = {"$lte": datetime.now(timezone.utc)}
    docs = await db.mural.find(f, {"_id": 0}).sort("publish_at", -1).to_list(300)
    return [_post(d, user["id"]) for d in docs]


@router.post("/mural", response_model=MuralPost)
async def create_post(body: MuralIn, user: dict = Depends(staff_only)):
    now = datetime.now(timezone.utc)
    doc = {**body.model_dump(), "id": str(uuid.uuid4()), "publish_at": _utc(body.publish_at) if body.publish_at else now,
           "liked_by": [], "created_by_name": user["name"], "created_at": now}
    await db.mural.insert_one(dict(doc))
    return _post(doc, user["id"])


@router.delete("/mural/{pid}")
async def delete_post(pid: str, user: dict = Depends(staff_only)):
    r = await db.mural.delete_one({"id": pid})
    if not r.deleted_count:
        raise HTTPException(404, "Publicação não encontrada")
    return {"ok": True}


@router.post("/mural/{pid}/like", response_model=MuralPost)
async def like(pid: str, user: dict = Depends(current_user)):
    d = await db.mural.find_one({"id": pid}, {"_id": 0})
    if not d:
        raise HTTPException(404, "Publicação não encontrada")
    op = "$pull" if user["id"] in d.get("liked_by", []) else "$addToSet"
    await db.mural.update_one({"id": pid}, {op: {"liked_by": user["id"]}})
    d = await db.mural.find_one({"id": pid}, {"_id": 0})
    return _post(d, user["id"])


@router.post("/content/viewed", response_model=XpOut)
async def viewed(body: ViewIn, user: dict = Depends(current_user)):
    key = {"user_id": user["id"], "kind": body.kind, "item_id": body.item_id}
    res = await db.content_views.update_one(key, {"$setOnInsert": key}, upsert=True)
    xp = 0
    if res.upserted_id is not None and user["role"] == "student":
        xp = await award_xp(user, 5, "Conteúdo assistido")
    return XpOut(xp_awarded=xp, xp=user.get("xp", 0))

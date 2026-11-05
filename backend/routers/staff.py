import uuid
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException

from lib.ai import generate_curriculum_questions, generate_image
from lib.auth import hash_password, manager_only, staff_only
from lib.curriculum import GRADE_LABEL, GRADES, subjects_for, topics_for
from lib.dates import today_iso
from lib.db import db
from lib.gamification import days_ago
from lib.quiz import save_questions
from models.schemas import (ClassIn, ClassRoom, CustomQuiz, Dashboard, QuestionFull, QuestionImageIn, ReportOverview, School,
                            StudentReport, StudentRow, TeacherGenerateIn, TeacherQuizIn, UploadOut, User, UserIn)
from routers.auth import DEFAULT_SCHOOL

router = APIRouter()
COLORS = ["#6366F1", "#10B981", "#F59E0B", "#0EA5E9", "#EC4899", "#8B5CF6", "#EF4444", "#14B8A6"]


def _topic(grade: str, subject: str, bimestre: int) -> dict:
    if grade not in GRADE_LABEL or subject not in subjects_for(grade):
        raise HTTPException(422, "Série ou disciplina inválida")
    t = topics_for(grade, subject)[bimestre - 1]
    return {**t, "grade": grade, "subject": subject}


# ---------- Professor: quizzes ----------
@router.post("/teacher/generate", response_model=list[QuestionFull])
async def teacher_generate(body: TeacherGenerateIn, user: dict = Depends(staff_only)):
    topic = _topic(body.grade, body.subject, body.bimestre)
    qs = await generate_curriculum_questions(topic, GRADE_LABEL[body.grade], body.count)
    if not qs:
        raise HTTPException(503, "Não foi possível gerar questões agora. Tente novamente.")
    return [QuestionFull(**q) for q in qs]


@router.post("/teacher/question-image", response_model=UploadOut)
async def teacher_image(body: QuestionImageIn, user: dict = Depends(staff_only)):
    url = await generate_image(body.prompt)
    if not url:
        raise HTTPException(503, "Não foi possível gerar a imagem agora. Tente novamente.")
    return UploadOut(url=url, filename=url.rsplit("/", 1)[-1], content_type="image/jpeg" if url.endswith(".jpg") else "image/png")


@router.post("/teacher/quizzes", response_model=CustomQuiz)
async def teacher_save(body: TeacherQuizIn, user: dict = Depends(staff_only)):
    topic = _topic(body.grade, body.subject, body.bimestre)
    for q in body.questions:
        if q.type != "association" and q.answer not in (["Verdadeiro", "Falso"] if q.type == "true_false" else q.options):
            raise HTTPException(422, f"A resposta correta deve ser uma das opções: {q.statement[:40]}")
    qs = [{**q.model_dump(exclude={"id"}), "options": ["Verdadeiro", "Falso"] if q.type == "true_false" else q.options} for q in body.questions]
    docs = await save_questions(qs, {"scope": "curriculum", "topic_id": topic["id"], "grade": body.grade, "subject": body.subject,
                                     "bimestre": body.bimestre, "habilidade": topic["habilidade"], "source": "professor"})
    cq = {"id": str(uuid.uuid4()), "title": body.title, "kind": body.kind, "grade": body.grade, "subject": body.subject,
          "bimestre": body.bimestre, "question_ids": [d["id"] for d in docs], "created_by": user["id"],
          "created_by_name": user["name"], "created_at": datetime.now(timezone.utc)}
    await db.custom_quizzes.insert_one(dict(cq))
    return CustomQuiz(**cq, question_count=len(docs))


@router.delete("/teacher/quizzes/{qid}")
async def teacher_delete(qid: str, user: dict = Depends(staff_only)):
    r = await db.custom_quizzes.delete_one({"id": qid})
    if not r.deleted_count:
        raise HTTPException(404, "Quiz não encontrado")
    return {"ok": True}


# ---------- Relatórios ----------
async def _student_rows(f: dict) -> list[dict]:
    students = await db.users.find({"role": "student", **f}, {"_id": 0, "password_hash": 0}).to_list(10000)
    classes = {c["id"]: c["name"] for c in await db.classes.find({}, {"_id": 0}).to_list(1000)}
    agg = await db.attempts.aggregate([
        {"$match": {"status": "done", "user_id": {"$in": [s["id"] for s in students]}}},
        {"$group": {"_id": "$user_id", "n": {"$sum": 1}, "avg": {"$avg": "$score"}}},
    ]).to_list(10000)
    a = {r["_id"]: r for r in agg}
    return [{"id": s["id"], "name": s["name"], "grade": s.get("grade"), "class_name": classes.get(s.get("class_id") or ""),
             "class_id": s.get("class_id"), "xp": s.get("xp", 0), "streak": s.get("streak", 0),
             "attempts": a.get(s["id"], {}).get("n", 0),
             "avg_score": round(a[s["id"]]["avg"]) if s["id"] in a else None} for s in students]


@router.get("/reports/overview", response_model=ReportOverview)
async def overview(grade: str = "", class_id: str = "", subject: str = "", user: dict = Depends(staff_only)):
    f: dict = {}
    if grade:
        f["grade"] = grade
    if class_id:
        f["class_id"] = class_id
    rows = await _student_rows(f)
    ids = [r["id"] for r in rows]
    m: dict = {"status": "done", "user_id": {"$in": ids}}
    if subject:
        m["subject"] = subject

    async def group(field: str) -> list[dict]:
        return await db.attempts.aggregate([{"$match": m}, {"$group": {
            "_id": f"${field}", "avg": {"$avg": "$score"}, "n": {"$sum": 1}, "u": {"$addToSet": "$user_id"}}}]).to_list(200)

    classes = {c["id"]: c["name"] for c in await db.classes.find({}, {"_id": 0}).to_list(1000)}
    fmt = lambda rs, lab: sorted([{"key": r["_id"], "label": lab(r["_id"]), "avg_score": round(r["avg"]), "attempts": r["n"],  # noqa: E731
                                   "students": len(r["u"])} for r in rs if r["_id"]], key=lambda x: x["label"])
    return ReportOverview(
        students=sorted(rows, key=lambda r: -r["xp"]),
        by_subject=fmt(await group("subject"), lambda k: k),
        by_grade=fmt(await group("grade"), lambda k: GRADE_LABEL.get(k, k)),
        by_class=fmt(await group("class_id"), lambda k: classes.get(k, k)),
    )


@router.get("/reports/student/{sid}", response_model=StudentReport)
async def student_report(sid: str, user: dict = Depends(staff_only)):
    rows = await _student_rows({"id": sid})
    if not rows:
        raise HTTPException(404, "Estudante não encontrado")
    agg = await db.attempts.aggregate([{"$match": {"user_id": sid, "status": "done"}}, {"$group": {
        "_id": "$subject", "c": {"$sum": "$correct"}, "t": {"$sum": "$total"}, "n": {"$sum": 1}}}]).to_list(50)
    hist = await db.attempts.find({"user_id": sid, "status": "done"}, {"_id": 0}).sort("finished_at", -1).to_list(20)
    return StudentReport(
        student=StudentRow(**rows[0]),
        by_subject=[{"subject": r["_id"], "accuracy": round(100 * r["c"] / r["t"]) if r["t"] else 0, "attempts": r["n"], "correct": r["c"]} for r in agg if r["_id"]],
        history=[{"date": h["date"], "title": h["title"], "subject": h["subject"], "score": h.get("score", 0)} for h in hist],
    )


# ---------- Gestor ----------
@router.get("/classes", response_model=list[ClassRoom])
async def classes(user: dict = Depends(staff_only)):
    docs = await db.classes.find({}, {"_id": 0}).sort("name", 1).to_list(1000)
    counts = {r["_id"]: r["n"] for r in await db.users.aggregate([{"$match": {"role": "student"}}, {"$group": {"_id": "$class_id", "n": {"$sum": 1}}}]).to_list(1000)}
    return [ClassRoom(**d, students=counts.get(d["id"], 0)) for d in docs]


@router.post("/admin/classes", response_model=ClassRoom)
async def create_class(body: ClassIn, user: dict = Depends(manager_only)):
    if body.grade not in GRADE_LABEL:
        raise HTTPException(422, "Série inválida")
    doc = {"id": str(uuid.uuid4()), **body.model_dump()}
    await db.classes.insert_one(dict(doc))
    return ClassRoom(**doc)


@router.delete("/admin/classes/{cid}")
async def delete_class(cid: str, user: dict = Depends(manager_only)):
    r = await db.classes.delete_one({"id": cid})
    if not r.deleted_count:
        raise HTTPException(404, "Turma não encontrada")
    await db.users.update_many({"class_id": cid}, {"$set": {"class_id": None}})
    return {"ok": True}


@router.get("/admin/users", response_model=list[User])
async def list_users(role: str = "", user: dict = Depends(manager_only)):
    docs = await db.users.find({"role": role} if role else {}, {"_id": 0, "password_hash": 0}).sort("name", 1).to_list(10000)
    return [User(**d) for d in docs]


@router.post("/admin/users", response_model=User)
async def create_user(body: UserIn, user: dict = Depends(manager_only)):
    email = body.email.strip().lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(409, "E-mail já cadastrado")
    if body.role == "student" and body.grade not in GRADE_LABEL:
        raise HTTPException(422, "Informe a série do estudante")
    children = []
    if body.role == "guardian":
        children = [u["id"] async for u in db.users.find({"id": {"$in": body.children_ids}, "role": "student"}, {"id": 1})]
        if not children:
            raise HTTPException(422, "Vincule pelo menos um estudante ao responsável")
    doc = {"id": str(uuid.uuid4()), "name": body.name, "email": email, "role": body.role,
           "grade": body.grade if body.role == "student" else None, "class_id": body.class_id if body.role == "student" else None,
           "password_hash": hash_password(body.password), "xp": 0, "streak": 0, "best_streak": 0,
           "avatar_color": COLORS[len(body.name) % len(COLORS)], "children_ids": children, "created_at": datetime.now(timezone.utc)}
    await db.users.insert_one(dict(doc))
    return User(**doc)


@router.delete("/admin/users/{uid}")
async def delete_user(uid: str, user: dict = Depends(manager_only)):
    if uid == user["id"]:
        raise HTTPException(400, "Você não pode remover a si mesmo")
    r = await db.users.delete_one({"id": uid})
    if not r.deleted_count:
        raise HTTPException(404, "Usuário não encontrado")
    return {"ok": True}


@router.put("/admin/school", response_model=School)
async def update_school(body: School, user: dict = Depends(manager_only)):
    await db.settings.update_one({"key": "school"}, {"$set": {"key": "school", **body.model_dump()}}, upsert=True)
    return body


@router.get("/admin/dashboard", response_model=Dashboard)
async def dashboard(user: dict = Depends(staff_only)):
    students = await db.users.count_documents({"role": "student"})
    teachers = await db.users.count_documents({"role": "teacher"})
    n_classes = await db.classes.count_documents({})
    student_ids = [u["id"] async for u in db.users.find({"role": "student"}, {"id": 1})]
    active = await db.xp_events.distinct("user_id", {"user_id": {"$in": student_ids}, "date": {"$gte": days_ago(6)}})
    agg = await db.attempts.aggregate([{"$match": {"status": "done"}}, {"$group": {
        "_id": None, "avg": {"$avg": "$score"}, "dur": {"$sum": "$duration_sec"}}}]).to_list(1)
    acc = await db.access_log.aggregate([{"$match": {"date": {"$gte": days_ago(13)}}}, {"$group": {"_id": "$date", "n": {"$sum": 1}}}]).to_list(30)
    am = {r["_id"]: r["n"] for r in acc}
    subj = await db.attempts.aggregate([{"$match": {"status": "done"}}, {"$group": {
        "_id": "$subject", "avg": {"$avg": "$score"}, "n": {"$sum": 1}, "u": {"$addToSet": "$user_id"}}}, {"$sort": {"n": -1}}]).to_list(50)
    top = [r["_id"] for r in subj if r["_id"]][:5]
    start = date.fromisoformat(today_iso()) - timedelta(weeks=6)
    ev = await db.attempts.aggregate([{"$match": {"status": "done", "subject": {"$in": top}, "date": {"$gte": start.isoformat()}}},
                                      {"$project": {"subject": 1, "score": 1, "date": 1}}]).to_list(100000)
    buckets: dict = defaultdict(lambda: defaultdict(list))
    for e in ev:
        w = min(5, (date.fromisoformat(e["date"]) - start).days // 7)
        buckets[w][e["subject"]].append(e["score"])
    evolution = [{"semana": f"Sem {w + 1}", **{s: round(sum(v) / len(v)) for s, v in buckets[w].items()}} for w in range(6)]
    return Dashboard(
        total_students=students, total_teachers=teachers, total_classes=n_classes,
        participation_rate=round(100 * len(active) / students) if students else 0,
        avg_score=round(agg[0]["avg"]) if agg and agg[0]["avg"] is not None else 0,
        study_hours=round((agg[0]["dur"] if agg else 0) / 3600, 1),
        daily_access=[{"date": days_ago(i), "count": am.get(days_ago(i), 0)} for i in range(13, -1, -1)],
        subject_performance=[{"key": r["_id"], "label": r["_id"], "avg_score": round(r["avg"]), "attempts": r["n"], "students": len(r["u"])} for r in subj if r["_id"]],
        evolution=evolution, evolution_subjects=top,
    )

from datetime import timezone

from fastapi import APIRouter, Depends, HTTPException

from lib.auth import current_user
from lib.curriculum import GRADE_LABEL, GRADES, find_topic, subjects_for, topics_for
from lib.db import db
from lib.duels import on_duel_submit
from lib.gamification import compute_medals, days_ago, level_info, ranking
from lib.quiz import MODES, create_attempt, grade_attempt, load_attempt, topic_questions
from models.schemas import (Attempt, Curriculum, CustomQuiz, GradeInfo, Progress, QuizResult, QuizStartIn,
                            RankingEntry, SubmitIn)

router = APIRouter()


@router.get("/curriculum/grades", response_model=list[GradeInfo])
async def grades():
    return [GradeInfo(code=c, label=label, level=lvl) for c, label, lvl in GRADES]


@router.get("/curriculum/{grade}", response_model=Curriculum)
async def curriculum(grade: str, user: dict = Depends(current_user)):
    if grade not in GRADE_LABEL:
        raise HTTPException(404, "Série não encontrada")
    rows = await db.attempts.aggregate([
        {"$match": {"user_id": user["id"], "status": "done", "topic_id": {"$regex": f"^{grade}-"}}},
        {"$group": {"_id": "$topic_id", "best": {"$max": "$score"}, "n": {"$sum": 1}, "c": {"$sum": "$correct"}, "t": {"$sum": "$total"}}},
    ]).to_list(500)
    stats = {r["_id"]: r for r in rows}
    subjects = []
    for s in subjects_for(grade):
        topics = [{**t, "best_score": stats.get(t["id"], {}).get("best"), "attempts": stats.get(t["id"], {}).get("n", 0)} for t in topics_for(grade, s)]
        c = sum(stats.get(t["id"], {}).get("c", 0) for t in topics)
        tt = sum(stats.get(t["id"], {}).get("t", 0) for t in topics)
        subjects.append({"subject": s, "topics": topics, "accuracy": round(100 * c / tt) if tt else None})
    return Curriculum(grade=grade, grade_label=GRADE_LABEL[grade], subjects=subjects)


@router.post("/quizzes/start", response_model=Attempt)
async def start_quiz(body: QuizStartIn, user: dict = Depends(current_user)):
    if body.custom_quiz_id:
        cq = await db.custom_quizzes.find_one({"id": body.custom_quiz_id}, {"_id": 0})
        if not cq:
            raise HTTPException(404, "Quiz não encontrado")
        qs = await db.questions.find({"id": {"$in": cq["question_ids"]}}, {"_id": 0}).to_list(100)
        att = await create_attempt(user, qs, kind="custom", title=cq["title"], subtitle=f"Criado por {cq['created_by_name']}",
                                   subject=cq["subject"], mode=cq["kind"], topic_id=None, time_limit_sec=None)
        return Attempt(**att)
    topic = find_topic(body.topic_id or "")
    if not topic:
        raise HTTPException(404, "Tópico não encontrado")
    n, label, _ = MODES[body.mode]
    qs = await topic_questions(topic, n)
    att = await create_attempt(user, qs, kind="quiz", title=f"{label} · {topic['subject']}",
                               subtitle=f"{topic['habilidade']} · {topic['objeto']}", subject=topic["subject"],
                               mode=body.mode, topic_id=topic["id"], time_limit_sec=None)
    return Attempt(**att)


@router.get("/quizzes/attempts/{attempt_id}", response_model=Attempt)
async def get_attempt(attempt_id: str, user: dict = Depends(current_user)):
    from lib.quiz import public_question
    att, qs = await load_attempt(attempt_id, user)
    return Attempt(**att, questions=[public_question(q) for q in qs])


@router.post("/quizzes/attempts/{attempt_id}/submit", response_model=QuizResult)
async def submit(attempt_id: str, body: SubmitIn, user: dict = Depends(current_user)):
    att, qs = await load_attempt(attempt_id, user)
    bonus = MODES.get(att["mode"], (0, "", 20))[2] if att["kind"] != "enem" else 5 * len(qs)
    res = await grade_attempt(att, qs, body.answers, body.duration_sec, user, bonus)
    if att["kind"] == "duel":
        res["suggestions"].insert(0, await on_duel_submit(att, res, body.duration_sec, user))
    return QuizResult(**res)


@router.get("/custom-quizzes", response_model=list[CustomQuiz])
async def custom_quizzes(user: dict = Depends(current_user)):
    q = {"grade": user.get("grade")} if user["role"] == "student" else {}
    docs = await db.custom_quizzes.find(q, {"_id": 0}).sort("created_at", -1).to_list(200)
    for d in docs:
        d["question_count"] = len(d["question_ids"])
        d["created_at"] = d["created_at"].replace(tzinfo=timezone.utc)
    return [CustomQuiz(**d) for d in docs]


@router.get("/me/progress", response_model=Progress)
async def progress(user: dict = Depends(current_user)):
    medals, ach, stats = await compute_medals(user)
    freq_rows = await db.xp_events.aggregate([
        {"$match": {"user_id": user["id"], "date": {"$gte": days_ago(34)}}},
        {"$group": {"_id": "$date", "xp": {"$sum": "$amount"}}},
    ]).to_list(100)
    fm = {r["_id"]: r["xp"] for r in freq_rows}
    frequency = [{"date": days_ago(i), "xp": fm.get(days_ago(i), 0)} for i in range(34, -1, -1)]
    by_subject = sorted([
        {"subject": s, "accuracy": round(100 * r["correct"] / r["total"]) if r["total"] else 0, "attempts": r["attempts"], "correct": r["correct"]}
        for s, r in stats["by_subject"].items() if s
    ], key=lambda x: -x["attempts"])
    hist = await db.attempts.find({"user_id": user["id"], "status": "done"}, {"_id": 0}).sort("finished_at", -1).to_list(12)
    dur = await db.attempts.aggregate([{"$match": {"user_id": user["id"], "status": "done"}},
                                       {"$group": {"_id": None, "s": {"$sum": "$duration_sec"}}}]).to_list(1)
    school = await ranking("all", "school", user) if user["role"] == "student" else []
    klass = await ranking("all", "class", user) if user.get("class_id") else []
    pos = lambda rows: next((r["position"] for r in rows if r["is_me"]), None)  # noqa: E731
    return Progress(
        user=user, **level_info(user.get("xp", 0)), medals=medals, achievements=ach, frequency=frequency,
        by_subject=by_subject,
        history=[{"date": h["date"], "title": h["title"], "subject": h["subject"], "score": h.get("score", 0)} for h in hist],
        class_rank=pos(klass), school_rank=pos(school), total_quizzes=stats["quizzes"],
        study_minutes=round((dur[0]["s"] if dur else 0) / 60), active_days_30=sum(1 for f in frequency[-30:] if f["xp"] > 0),
    )


@router.get("/rankings", response_model=list[RankingEntry])
async def rankings(period: str = "weekly", scope: str = "school", user: dict = Depends(current_user)):
    if period not in {"daily", "weekly", "monthly", "all"} or scope not in {"class", "school"}:
        raise HTTPException(422, "Parâmetros inválidos")
    rows = await ranking(period, scope, user)
    top = rows[:50]
    me = next((r for r in rows if r["is_me"]), None)
    if me and me not in top:
        top.append(me)
    return top

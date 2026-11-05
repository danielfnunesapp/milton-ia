from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

Role = Literal["student", "teacher", "manager", "guardian"]
QType = Literal["multiple_choice", "true_false", "complete", "association"]


# ---------- auth / school ----------
class User(BaseModel):
    id: str
    name: str
    email: str
    role: Role
    grade: str | None = None
    class_id: str | None = None
    xp: int = 0
    streak: int = 0
    best_streak: int = 0
    avatar_color: str = "#6366F1"
    children_ids: list[str] = []


class LoginIn(BaseModel):
    email: str
    password: str


class School(BaseModel):
    name: str
    logo_url: str | None = None
    city: str = ""
    diretoria: str = ""


# ---------- curriculum ----------
class GradeInfo(BaseModel):
    code: str
    label: str
    level: str


class Topic(BaseModel):
    id: str
    bimestre: int
    unidade: str
    habilidade: str
    objeto: str
    best_score: int | None = None
    attempts: int = 0


class SubjectTrail(BaseModel):
    subject: str
    topics: list[Topic]
    accuracy: int | None = None


class Curriculum(BaseModel):
    grade: str
    grade_label: str
    subjects: list[SubjectTrail]


# ---------- questions / quizzes ----------
class Pair(BaseModel):
    left: str
    right: str


class QuestionFull(BaseModel):
    id: str | None = None
    type: QType
    statement: str
    options: list[str] = []
    answer: str = ""
    pairs: list[Pair] = []
    explanation: str = ""
    image_url: str | None = None


class QuestionPublic(BaseModel):
    id: str
    type: QType
    statement: str
    options: list[str] = []
    left: list[str] = []
    right: list[str] = []
    image_url: str | None = None


class QuizStartIn(BaseModel):
    topic_id: str | None = None
    mode: Literal["rapido", "completo", "master"] = "rapido"
    custom_quiz_id: str | None = None


class Attempt(BaseModel):
    id: str
    kind: Literal["quiz", "custom", "enem", "duel"]
    title: str
    subtitle: str = ""
    subject: str
    mode: str
    status: str
    questions: list[QuestionPublic]
    time_limit_sec: int | None = None


class SubmitIn(BaseModel):
    answers: dict[str, str | dict[str, str]] = {}
    duration_sec: int = 0


class Medal(BaseModel):
    id: str
    name: str
    emoji: str
    description: str
    progress: float
    unlocked: bool


class ResultItem(BaseModel):
    question_id: str
    type: str
    statement: str
    your_answer: str
    correct_answer: str
    is_correct: bool
    explanation: str
    image_url: str | None = None


class QuizResult(BaseModel):
    attempt_id: str
    title: str
    correct: int
    wrong: int
    total: int
    score: int
    xp_earned: int
    items: list[ResultItem]
    suggestions: list[str]
    new_medals: list[Medal]
    xp: int
    level: int
    streak: int


class CustomQuiz(BaseModel):
    id: str
    title: str
    kind: Literal["quiz", "desafio"]
    grade: str
    subject: str
    bimestre: int
    question_count: int
    created_by_name: str
    created_at: datetime


class TeacherGenerateIn(BaseModel):
    grade: str
    subject: str
    bimestre: int = Field(ge=1, le=4)
    count: int = Field(5, ge=1, le=10)


class TeacherQuizIn(BaseModel):
    title: str = Field(min_length=2)
    kind: Literal["quiz", "desafio"] = "quiz"
    grade: str
    subject: str
    bimestre: int = Field(ge=1, le=4)
    questions: list[QuestionFull] = Field(min_length=1)


# ---------- progress / ranking ----------
class DayXp(BaseModel):
    date: str
    xp: int


class SubjectStat(BaseModel):
    subject: str
    accuracy: int
    attempts: int
    correct: int


class HistoryItem(BaseModel):
    date: str
    title: str
    subject: str
    score: int


class Progress(BaseModel):
    user: User
    level: int
    level_name: str
    xp_into_level: int
    xp_for_next: int
    medals: list[Medal]
    achievements: list[Medal]
    frequency: list[DayXp]
    by_subject: list[SubjectStat]
    history: list[HistoryItem]
    class_rank: int | None
    school_rank: int | None
    total_quizzes: int
    study_minutes: int
    active_days_30: int


class RankingEntry(BaseModel):
    position: int
    user_id: str
    name: str
    grade: str | None
    class_name: str | None
    xp: int
    avatar_color: str
    is_me: bool


# ---------- ENEM ----------
class EnemStartIn(BaseModel):
    area: Literal["linguagens", "matematica", "natureza", "humanas"]
    count: Literal[5, 10, 20] = 10


class EnemAreaStat(BaseModel):
    area: str
    label: str
    accuracy: int
    attempts: int
    answered: int


class EnemStats(BaseModel):
    areas: list[EnemAreaStat]
    simulados: int
    avg_score: int
    best_essay: int | None
    plan: list[str]


class EssayIn(BaseModel):
    tema: str = Field(min_length=3)
    texto: str = Field(min_length=200)


class Competencia(BaseModel):
    numero: int
    nome: str
    nota: int
    comentario: str


class Essay(BaseModel):
    id: str
    tema: str
    texto: str
    competencias: list[Competencia]
    nota_total: int
    comentario_geral: str
    sugestoes: list[str]
    created_at: datetime


# ---------- content ----------
class UploadOut(BaseModel):
    url: str
    filename: str
    content_type: str


MaterialType = Literal["pdf", "apostila", "slides", "link", "seduc"]


class MaterialIn(BaseModel):
    title: str = Field(min_length=2)
    description: str = ""
    type: MaterialType
    url: str = Field(min_length=1)
    grade: str | None = None
    subject: str | None = None


class Material(MaterialIn):
    id: str
    created_by_name: str
    created_at: datetime


MuralCategory = Literal["Ciências", "Matemática", "História", "Geografia", "Atualidades", "ENEM", "Vestibulares"]


class MuralIn(BaseModel):
    title: str = Field(min_length=2)
    description: str = ""
    category: MuralCategory
    media_type: Literal["image", "video"]
    media_url: str = Field(min_length=1)
    alt_text: str = ""
    publish_at: datetime | None = None


class MuralPost(BaseModel):
    id: str
    title: str
    description: str
    category: str
    media_type: str
    media_url: str
    alt_text: str
    publish_at: datetime
    scheduled: bool
    likes: int
    liked: bool
    created_by_name: str


class ViewIn(BaseModel):
    kind: Literal["material", "mural"]
    item_id: str


class XpOut(BaseModel):
    xp_awarded: int
    xp: int


# ---------- tutor ----------
class TutorChatIn(BaseModel):
    session_id: str | None = None
    message: str = Field(min_length=1, max_length=8000)
    mode: Literal["explicar", "duvida", "questoes", "resumir", "mapa_mental", "plano"] = "duvida"


class TutorSession(BaseModel):
    session_id: str
    title: str
    updated_at: datetime


class TutorMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str
    created_at: datetime


# ---------- staff ----------
class ClassRoom(BaseModel):
    id: str
    name: str
    grade: str
    students: int = 0


class ClassIn(BaseModel):
    name: str = Field(min_length=1)
    grade: str


class UserIn(BaseModel):
    name: str = Field(min_length=2)
    email: str = Field(min_length=3)
    password: str = Field(min_length=6)
    role: Role
    grade: str | None = None
    class_id: str | None = None
    children_ids: list[str] = []


class StudentRow(BaseModel):
    id: str
    name: str
    grade: str | None
    class_name: str | None
    xp: int
    streak: int
    attempts: int
    avg_score: int | None


class GroupStat(BaseModel):
    key: str
    label: str
    avg_score: int | None
    attempts: int
    students: int = 0


class ReportOverview(BaseModel):
    students: list[StudentRow]
    by_subject: list[GroupStat]
    by_grade: list[GroupStat]
    by_class: list[GroupStat]


class StudentReport(BaseModel):
    student: StudentRow
    by_subject: list[SubjectStat]
    history: list[HistoryItem]


class DailyCount(BaseModel):
    date: str
    count: int


class Dashboard(BaseModel):
    total_students: int
    total_teachers: int
    total_classes: int
    participation_rate: int
    avg_score: int
    study_hours: float
    daily_access: list[DailyCount]
    subject_performance: list[GroupStat]
    evolution: list[dict[str, float | str]]
    evolution_subjects: list[str]


class QuestionImageIn(BaseModel):
    prompt: str = Field(min_length=5, max_length=1500)


# ---------- duelos ----------
class DuelIn(BaseModel):
    opponent_id: str
    topic_id: str


class Opponent(BaseModel):
    id: str
    name: str
    class_name: str | None
    avatar_color: str


class Duel(BaseModel):
    id: str
    subject: str
    topic_label: str
    challenger_name: str
    opponent_name: str
    my_side: Literal["challenger", "opponent"]
    status: Literal["pending", "active", "done", "declined", "expired"]
    total: int
    my_score: int | None
    their_score: int | None
    winner_name: str | None
    i_won: bool
    my_attempt_id: str | None
    my_done: bool
    can_accept: bool
    bonus_xp: int
    expires_at: datetime
    created_at: datetime


# ---------- família ----------
class ChildSummary(BaseModel):
    id: str
    name: str
    grade: str | None
    class_name: str | None
    avatar_color: str
    level: int
    level_name: str
    xp: int
    xp_week: int
    xp_prev_week: int
    streak: int
    best_streak: int
    active_days_week: int
    quizzes_week: int
    avg_score_week: int | None
    study_minutes_week: int
    daily: list[DayXp]
    attention: list[SubjectStat]
    strengths: list[SubjectStat]
    medals_unlocked: int
    medals_total: int
    duels_won_week: int

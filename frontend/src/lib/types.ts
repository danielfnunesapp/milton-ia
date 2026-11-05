// Hand-written mirrors of backend/models/schemas.py — keep in sync.
export type Role = "student" | "teacher" | "manager" | "guardian";
export type QType = "multiple_choice" | "true_false" | "complete" | "association";

export interface User {
  id: string; name: string; email: string; role: Role; grade: string | null; class_id: string | null;
  xp: number; streak: number; best_streak: number; avatar_color: string; children_ids: string[];
}
export interface School { name: string; logo_url: string | null; city: string; diretoria: string }
export interface LoginIn { email: string; password: string }
export interface GradeInfo { code: string; label: string; level: string }
export interface Topic {
  id: string; bimestre: number; unidade: string; habilidade: string; objeto: string;
  best_score: number | null; attempts: number;
}
export interface SubjectTrail { subject: string; topics: Topic[]; accuracy: number | null }
export interface Curriculum { grade: string; grade_label: string; subjects: SubjectTrail[] }

export interface Pair { left: string; right: string }
export interface QuestionFull {
  id?: string | null; type: QType; statement: string; options: string[]; answer: string; pairs: Pair[]; explanation: string;
  image_url: string | null;
}
export interface QuestionPublic { id: string; type: QType; statement: string; options: string[]; left: string[]; right: string[]; image_url: string | null }
export type QuizMode = "rapido" | "completo" | "master";
export interface QuizStartIn { topic_id?: string; mode?: QuizMode; custom_quiz_id?: string }
export interface Attempt {
  id: string; kind: "quiz" | "custom" | "enem" | "duel"; title: string; subtitle: string; subject: string; mode: string;
  status: string; questions: QuestionPublic[]; time_limit_sec: number | null;
}
export type AnswerValue = string | Record<string, string>;
export interface SubmitIn { answers: Record<string, AnswerValue>; duration_sec: number }
export interface Medal { id: string; name: string; emoji: string; description: string; progress: number; unlocked: boolean }
export interface ResultItem {
  question_id: string; type: string; statement: string; your_answer: string; correct_answer: string; is_correct: boolean; explanation: string;
  image_url: string | null;
}
export interface QuizResult {
  attempt_id: string; title: string; correct: number; wrong: number; total: number; score: number; xp_earned: number;
  items: ResultItem[]; suggestions: string[]; new_medals: Medal[]; xp: number; level: number; streak: number;
}
export interface CustomQuiz {
  id: string; title: string; kind: "quiz" | "desafio"; grade: string; subject: string; bimestre: number;
  question_count: number; created_by_name: string; created_at: string;
}
export interface TeacherGenerateIn { grade: string; subject: string; bimestre: number; count: number }
export interface TeacherQuizIn {
  title: string; kind: "quiz" | "desafio"; grade: string; subject: string; bimestre: number; questions: QuestionFull[];
}

export interface DayXp { date: string; xp: number }
export interface SubjectStat { subject: string; accuracy: number; attempts: number; correct: number }
export interface HistoryItem { date: string; title: string; subject: string; score: number }
export interface Progress {
  user: User; level: number; level_name: string; xp_into_level: number; xp_for_next: number;
  medals: Medal[]; achievements: Medal[]; frequency: DayXp[]; by_subject: SubjectStat[]; history: HistoryItem[];
  class_rank: number | null; school_rank: number | null; total_quizzes: number; study_minutes: number; active_days_30: number;
}
export interface RankingEntry {
  position: number; user_id: string; name: string; grade: string | null; class_name: string | null;
  xp: number; avatar_color: string; is_me: boolean;
}

export type EnemArea = "linguagens" | "matematica" | "natureza" | "humanas";
export interface EnemStartIn { area: EnemArea; count: 5 | 10 | 20 }
export interface EnemAreaStat { area: string; label: string; accuracy: number; attempts: number; answered: number }
export interface EnemStats { areas: EnemAreaStat[]; simulados: number; avg_score: number; best_essay: number | null; plan: string[] }
export interface EssayIn { tema: string; texto: string }
export interface Competencia { numero: number; nome: string; nota: number; comentario: string }
export interface Essay {
  id: string; tema: string; texto: string; competencias: Competencia[]; nota_total: number;
  comentario_geral: string; sugestoes: string[]; created_at: string;
}

export interface UploadOut { url: string; filename: string; content_type: string }
export type MaterialType = "pdf" | "apostila" | "slides" | "link" | "seduc";
export interface MaterialIn {
  title: string; description: string; type: MaterialType; url: string; grade: string | null; subject: string | null;
}
export interface Material extends MaterialIn { id: string; created_by_name: string; created_at: string }
export const MURAL_CATEGORIES = ["Ciências", "Matemática", "História", "Geografia", "Atualidades", "ENEM", "Vestibulares"] as const;
export type MuralCategory = (typeof MURAL_CATEGORIES)[number];
export interface MuralIn {
  title: string; description: string; category: MuralCategory; media_type: "image" | "video";
  media_url: string; alt_text: string; publish_at: string | null;
}
export interface MuralPost {
  id: string; title: string; description: string; category: string; media_type: string; media_url: string;
  alt_text: string; publish_at: string; scheduled: boolean; likes: number; liked: boolean; created_by_name: string;
}
export interface ViewIn { kind: "material" | "mural"; item_id: string }
export interface XpOut { xp_awarded: number; xp: number }

export type TutorMode = "explicar" | "duvida" | "questoes" | "resumir" | "mapa_mental" | "plano";
export interface TutorChatIn { session_id: string | null; message: string; mode: TutorMode }
export interface TutorSession { session_id: string; title: string; updated_at: string }
export interface TutorMessage { role: "user" | "assistant"; content: string; created_at: string }

export interface ClassRoom { id: string; name: string; grade: string; students: number }
export interface ClassIn { name: string; grade: string }
export interface UserIn {
  name: string; email: string; password: string; role: Role; grade: string | null; class_id: string | null; children_ids: string[];
}
export interface StudentRow {
  id: string; name: string; grade: string | null; class_name: string | null; xp: number; streak: number;
  attempts: number; avg_score: number | null;
}
export interface GroupStat { key: string; label: string; avg_score: number | null; attempts: number; students: number }
export interface ReportOverview { students: StudentRow[]; by_subject: GroupStat[]; by_grade: GroupStat[]; by_class: GroupStat[] }
export interface StudentReport { student: StudentRow; by_subject: SubjectStat[]; history: HistoryItem[] }
export interface DailyCount { date: string; count: number }
export interface Dashboard {
  total_students: number; total_teachers: number; total_classes: number; participation_rate: number; avg_score: number;
  study_hours: number; daily_access: DailyCount[]; subject_performance: GroupStat[];
  evolution: Array<Record<string, number | string>>; evolution_subjects: string[];
}

export interface QuestionImageIn { prompt: string }

export interface DuelIn { opponent_id: string; topic_id: string }
export interface Opponent { id: string; name: string; class_name: string | null; avatar_color: string }
export interface Duel {
  id: string; subject: string; topic_label: string; challenger_name: string; opponent_name: string;
  my_side: "challenger" | "opponent"; status: "pending" | "active" | "done" | "declined" | "expired"; total: number;
  my_score: number | null; their_score: number | null; winner_name: string | null; i_won: boolean;
  my_attempt_id: string | null; my_done: boolean; can_accept: boolean; can_rematch: boolean; bonus_xp: number; expires_at: string; created_at: string;
}

export interface ChildSummary {
  id: string; name: string; grade: string | null; class_name: string | null; avatar_color: string; level: number; level_name: string;
  xp: number; xp_week: number; xp_prev_week: number; streak: number; best_streak: number; active_days_week: number;
  quizzes_week: number; avg_score_week: number | null; study_minutes_week: number; daily: DayXp[];
  attention: SubjectStat[]; strengths: SubjectStat[]; medals_unlocked: number; medals_total: number; duels_won_week: number;
}

// ---- static labels ----
export const GRADE_SHORT: Record<string, string> = {
  "6EF": "6º Ano", "7EF": "7º Ano", "8EF": "8º Ano", "9EF": "9º Ano", "1EM": "1ª Série EM", "2EM": "2ª Série EM", "3EM": "3ª Série EM",
};
export const EF_SUBJECTS = ["Língua Portuguesa", "Matemática", "Ciências", "História", "Geografia", "Arte", "Inglês"];
export const EM_SUBJECTS = ["Língua Portuguesa", "Matemática", "Física", "Química", "Biologia", "História", "Geografia", "Filosofia", "Sociologia", "Inglês"];
export const subjectsFor = (g: string) => (g.endsWith("EM") ? EM_SUBJECTS : EF_SUBJECTS);
export const ROLE_LABEL: Record<Role, string> = { student: "Estudante", teacher: "Professor(a)", manager: "Gestor(a)", guardian: "Responsável" };
export const SUBJECT_EMOJI: Record<string, string> = {
  "Língua Portuguesa": "📖", Matemática: "📐", Ciências: "🔬", História: "🏛️", Geografia: "🌎", Arte: "🎨", Inglês: "🗽",
  Física: "⚛️", Química: "🧪", Biologia: "🧬", Filosofia: "🦉", Sociologia: "👥",
};

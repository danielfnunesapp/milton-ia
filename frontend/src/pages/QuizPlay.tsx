import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, Lightbulb, Loader2, Sparkles, X, XCircle, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import QuestionView from "@/components/QuestionView";
import { Confetti, CountUp, ProgressBar, Skeleton } from "@/components/common";
import { apiGet, apiPost, errorMessage } from "@/lib/api";
import { playSound, usePrefs } from "@/lib/prefs";
import type { AnswerValue, Attempt, QuizResult, SubmitIn } from "@/lib/types";
import { cn } from "@/lib/utils";

function fmt(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function answered(v: AnswerValue | undefined) {
  return typeof v === "string" ? v.length > 0 : !!v && Object.keys(v).length > 0;
}

function Results({ r, kind }: { r: QuizResult; kind: string }) {
  const great = r.score >= 70;
  const back = kind === "enem" ? "/enem" : kind === "duel" ? "/duelos" : "/trilhas";
  const backLabel = kind === "enem" ? "Missão ENEM" : kind === "duel" ? "Duelos" : "Trilhas";
  return (
    <div className="max-w-3xl mx-auto" data-testid="quiz-results">
      {great && <Confetti />}
      <div className="card-tactile p-6 md:p-8 text-center relative overflow-hidden">
        <div className="absolute inset-0 dot-grid opacity-60 decor" aria-hidden />
        <div className="relative">
          <p className="text-5xl animate-pop" aria-hidden>{r.score === 100 ? "🏆" : great ? "🎉" : r.score >= 40 ? "💪" : "📚"}</p>
          <h1 className="text-3xl md:text-4xl font-bold mt-2">{r.score === 100 ? "Gabaritou!" : great ? "Mandou bem!" : "Continue praticando!"}</h1>
          <p className="text-muted-foreground mt-1">{r.title}</p>
          <div className="grid grid-cols-3 gap-3 mt-6">
            <div className="rounded-2xl bg-success/10 p-4"><div className="text-3xl font-heading font-bold text-success" data-testid="result-correct">{r.correct}</div><div className="text-xs font-semibold">Acertos</div></div>
            <div className="rounded-2xl bg-ruby/10 p-4"><div className="text-3xl font-heading font-bold text-ruby" data-testid="result-wrong">{r.wrong}</div><div className="text-xs font-semibold">Erros</div></div>
            <div className="rounded-2xl bg-xp/15 p-4"><div className="text-3xl font-heading font-bold text-amber-600 dark:text-xp" data-testid="result-xp">+<CountUp to={r.xp_earned} /></div><div className="text-xs font-semibold">XP ganho</div></div>
          </div>
          <div className="mt-5"><ProgressBar value={r.score} tone={great ? "bg-success" : "bg-xp"} testid="result-score-bar" /><p className="text-sm mt-2 font-semibold" data-testid="result-score">{r.score}% de aproveitamento · Nível {r.level} · 🔥 {r.streak} dia(s)</p></div>
        </div>
      </div>

      {r.new_medals.length > 0 && (
        <div className="card-tactile p-5 mt-5 bg-xp/10" data-testid="result-new-medals">
          <p className="font-heading font-bold">Nova conquista desbloqueada!</p>
          <div className="flex flex-wrap gap-3 mt-3">
            {r.new_medals.map((m) => (
              <div key={m.id} className="animate-pop flex items-center gap-2 rounded-xl bg-card px-3 py-2 border"><span className="text-2xl">{m.emoji}</span><span className="font-semibold text-sm">{m.name}</span></div>
            ))}
          </div>
        </div>
      )}

      <div className="card-tactile p-5 mt-5">
        <p className="font-heading font-bold flex items-center gap-2"><Lightbulb className="size-5 text-xp" /> Sugestões de estudo</p>
        <ul className="mt-2 space-y-1.5 text-sm" data-testid="result-suggestions">
          {r.suggestions.map((s) => <li key={s} className="flex gap-2"><span className="text-brand">•</span>{s}</li>)}
        </ul>
      </div>

      <h2 className="text-xl font-bold mt-8 mb-3">Correção comentada</h2>
      <div className="space-y-3">
        {r.items.map((it, i) => (
          <div key={it.question_id} className={cn("card-tactile p-4 border-l-4", it.is_correct ? "border-l-success" : "border-l-ruby")} data-testid={`result-item-${i}`}>
            <div className="flex gap-2">
              {it.is_correct ? <CheckCircle2 className="size-5 text-success shrink-0 mt-0.5" /> : <XCircle className="size-5 text-ruby shrink-0 mt-0.5" />}
              <p className="font-semibold whitespace-pre-line">{i + 1}. {it.statement}</p>
            </div>
            {it.image_url && <img src={it.image_url} alt={`Imagem da questão ${i + 1}`} className="ml-7 mt-2 max-h-48 rounded-xl border bg-white object-contain p-1" />}
            <div className="mt-2 pl-7 text-sm space-y-1">
              <p><span className="text-muted-foreground">Sua resposta:</span> <span className={it.is_correct ? "text-success font-semibold" : "text-ruby font-semibold"}>{it.your_answer}</span></p>
              {!it.is_correct && <p><span className="text-muted-foreground">Resposta correta:</span> <span className="font-semibold">{it.correct_answer}</span></p>}
              {it.explanation && <p className="rounded-lg bg-muted p-2.5 mt-2">💡 {it.explanation}</p>}
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-3 mt-8">
        <Link to={back} className={cn(buttonVariants({ size: "lg" }), "btn-3d")} data-testid="result-back-button">Voltar para {backLabel}</Link>
        <Link to="/tutor" className={buttonVariants({ variant: "outline", size: "lg" })} data-testid="result-tutor-button"><Sparkles /> Revisar com o Tutor</Link>
      </div>
    </div>
  );
}

export default function QuizPlay() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { sound } = usePrefs();
  const { data: att, isLoading, isError } = useQuery({ queryKey: ["attempt", id], queryFn: () => apiGet<Attempt>(`/quizzes/attempts/${id}`) });
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<QuizResult | null>(null);
  const started = useRef(Date.now());

  const submit = useMutation({
    mutationFn: (body: SubmitIn) => apiPost<QuizResult>(`/quizzes/attempts/${id}/submit`, body),
    onSuccess: (r) => {
      setResult(r);
      playSound(r.score >= 70 ? "levelup" : "correct", sound);
      ["me", "progress", "curriculum", "enem-stats", "rankings", "duels"].forEach((k) => void qc.invalidateQueries({ queryKey: [k] }));
      window.scrollTo({ top: 0 });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const finish = useCallback(() => {
    if (!submit.isPending && !result) submit.mutate({ answers, duration_sec: Math.round((Date.now() - started.current) / 1000) });
  }, [answers, submit, result]);

  useEffect(() => {
    if (result || !att) return;
    const t = setInterval(() => setElapsed(Math.round((Date.now() - started.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, [result, att]);

  const limit = att?.time_limit_sec ?? null;
  const remaining = limit ? limit - elapsed : null;
  useEffect(() => {
    if (remaining !== null && remaining <= 0 && !result) {
      toast.info("Tempo esgotado! Enviando suas respostas…");
      finish();
    }
  }, [remaining, result, finish]);

  if (result) return <Results r={result} kind={att?.kind ?? "quiz"} />;
  if (isError || (att && att.status === "done")) {
    return (
      <div className="card-tactile p-8 text-center" data-testid="quiz-unavailable">
        <p className="font-heading font-bold text-xl">Esta atividade já foi concluída ou não está disponível.</p>
        <Link to="/trilhas" className={cn(buttonVariants(), "mt-4")}>Ir para Trilhas</Link>
      </div>
    );
  }
  if (isLoading || !att) return <div className="max-w-3xl mx-auto space-y-4"><Skeleton className="h-10" /><Skeleton className="h-64" /></div>;

  const q = att.questions[idx];
  const last = idx === att.questions.length - 1;
  const done = Object.keys(answers).filter((k) => answered(answers[k])).length;

  return (
    <div className="max-w-3xl mx-auto" data-testid="quiz-player">
      <div className="flex items-center gap-3 mb-2">
        <Button variant="ghost" size="icon" aria-label="Sair do quiz" data-testid="quiz-exit-button" onClick={() => nav(att.kind === "enem" ? "/enem" : att.kind === "duel" ? "/duelos" : "/trilhas")}><X /></Button>
        <ProgressBar value={(100 * (idx + 1)) / att.questions.length} className="flex-1 h-4" testid="quiz-progress-bar" />
        <span className={cn("inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-mono font-bold", remaining !== null && remaining < 60 ? "bg-ruby/15 text-ruby" : "bg-muted")} data-testid="quiz-timer">
          <Clock className="size-4" /> {remaining !== null ? fmt(remaining) : fmt(elapsed)}
        </span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-6 px-1">
        <p className="text-sm text-muted-foreground"><span className="font-semibold text-foreground" data-testid="quiz-title">{att.title}</span> · {att.subtitle}</p>
        <p className="text-sm font-semibold" data-testid="quiz-counter">{idx + 1}/{att.questions.length}</p>
      </div>

      <div className="card-tactile p-5 md:p-7">
        <QuestionView q={q} index={idx} value={answers[q.id]} onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mt-6">
        <div className="flex gap-1.5 flex-wrap" aria-label="Navegar entre questões">
          {att.questions.map((qq, i) => (
            <button key={qq.id} type="button" onClick={() => setIdx(i)} data-testid={`quiz-dot-${i}`} aria-label={`Questão ${i + 1}`}
              className={cn("size-7 rounded-lg text-xs font-bold border-2 transition-colors duration-150", i === idx ? "border-tutor bg-tutor text-white" : answered(answers[qq.id]) ? "border-brand bg-brand/15" : "border-border")}>
              {i + 1}
            </button>
          ))}
        </div>
        <div className="flex gap-2 ml-auto">
          {idx > 0 && <Button variant="outline" size="lg" onClick={() => setIdx(idx - 1)} data-testid="quiz-prev-button">Anterior</Button>}
          {!last ? (
            <Button size="lg" className="btn-3d min-w-36" onClick={() => setIdx(idx + 1)} data-testid="quiz-next-button">
              {answered(answers[q.id]) ? "Confirmar" : "Pular"}
            </Button>
          ) : (
            <Button size="lg" className="btn-3d min-w-36 bg-xp text-black hover:bg-xp" disabled={submit.isPending} onClick={finish} data-testid="quiz-finish-button">
              {submit.isPending ? <Loader2 className="animate-spin" /> : <Zap />} Finalizar ({done}/{att.questions.length})
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

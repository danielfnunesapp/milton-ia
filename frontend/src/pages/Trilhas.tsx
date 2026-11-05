import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ChevronRight, Crown, Loader2, Rocket, Sparkles, Swords, Timer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, PageHeader, ProgressBar, Skeleton } from "@/components/common";
import { apiGet, apiPost, errorMessage } from "@/lib/api";
import { useMe } from "@/lib/hooks";
import { GRADE_SHORT, SUBJECT_EMOJI, type Attempt, type Curriculum, type CustomQuiz, type QuizMode, type QuizStartIn, type SubjectTrail } from "@/lib/types";
import { cn } from "@/lib/utils";

const MODES: { mode: QuizMode; label: string; n: number; icon: React.ReactNode; cls: string }[] = [
  { mode: "rapido", label: "Quiz Rápido", n: 5, icon: <Timer />, cls: "bg-brand text-white hover:bg-brand/90" },
  { mode: "completo", label: "Quiz Completo", n: 10, icon: <Rocket />, cls: "bg-sky text-white hover:bg-sky/90" },
  { mode: "master", label: "Desafio Master", n: 20, icon: <Crown />, cls: "bg-xp text-black hover:bg-xp/90" },
];

export function PreparingDialog({ open, label }: { open: boolean; label: string }) {
  return (
    <Dialog open={open}>
      <DialogContent showCloseButton={false} className="text-center" data-testid="quiz-preparing-dialog">
        <div className="mx-auto size-16 rounded-full bg-tutor/15 grid place-items-center animate-pulse-ring"><Sparkles className="size-8 text-tutor" /></div>
        <DialogTitle className="font-heading text-xl">Milton I.A está preparando suas questões…</DialogTitle>
        <DialogDescription>{label} — questões geradas com base no Currículo Paulista e no Currículo Priorizado da SEDUC-SP. Isso pode levar alguns segundos.</DialogDescription>
        <Loader2 className="mx-auto animate-spin text-brand" />
      </DialogContent>
    </Dialog>
  );
}

function SubjectPath({ trail, onStart, pending }: { trail: SubjectTrail; onStart: (b: QuizStartIn, label: string) => void; pending: boolean }) {
  return (
    <div className="relative pl-8 md:pl-12" data-testid="subject-path">
      <div className="absolute left-3 md:left-5 top-2 bottom-2 w-1 rounded-full bg-gradient-to-b from-brand via-sky to-xp decor" aria-hidden />
      <div className="space-y-5">
        {trail.topics.map((t) => (
          <div key={t.id} className="relative" data-testid={`topic-${t.bimestre}`}>
            <div className={cn("absolute -left-8 md:-left-12 top-4 size-7 md:size-10 rounded-full grid place-items-center font-heading font-bold text-white text-sm ring-4 ring-background",
              t.best_score === null ? "bg-muted-foreground/50" : t.best_score >= 70 ? "bg-success" : "bg-xp")}>{t.bimestre}º</div>
            <div className="card-tactile p-4 md:p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{t.bimestre}º Bimestre</Badge>
                <Badge variant="outline" className="font-mono">{t.habilidade}</Badge>
                {t.best_score !== null && <Badge className="bg-success/15 text-success" data-testid={`topic-best-${t.bimestre}`}>Melhor: {t.best_score}%</Badge>}
              </div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground mt-3">Unidade temática · {t.unidade}</p>
              <h3 className="text-lg font-bold mt-0.5">{t.objeto}</h3>
              <p className="text-xs text-muted-foreground">Objeto de conhecimento · {t.attempts} tentativa(s)</p>
              <div className="flex flex-wrap gap-2 mt-4">
                {MODES.map((m) => (
                  <Button key={m.mode} size="sm" disabled={pending} className={cn("btn-3d", m.cls)} data-testid={`start-${m.mode}-b${t.bimestre}`}
                    onClick={() => onStart({ topic_id: t.id, mode: m.mode }, `${m.label} · ${t.objeto}`)}>
                    {m.icon}{m.label} · {m.n}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Trilhas() {
  const me = useMe();
  const nav = useNavigate();
  const [grade, setGrade] = useState<string | null>(null);
  const g = grade ?? me.data?.grade ?? "6EF";
  const [subject, setSubject] = useState<string | null>(null);
  const [preparing, setPreparing] = useState("");

  const cur = useQuery({ queryKey: ["curriculum", g], queryFn: () => apiGet<Curriculum>(`/curriculum/${g}`) });
  const custom = useQuery({ queryKey: ["custom-quizzes"], queryFn: () => apiGet<CustomQuiz[]>("/custom-quizzes") });
  const start = useMutation({
    mutationFn: (b: QuizStartIn) => apiPost<Attempt>("/quizzes/start", b),
    onSuccess: (a) => nav(`/quiz/${a.id}`),
    onError: (e) => toast.error(errorMessage(e)),
    onSettled: () => setPreparing(""),
  });
  const run = (b: QuizStartIn, label: string) => { setPreparing(label); start.mutate(b); };

  const trails = cur.data?.subjects ?? [];
  const active = trails.find((t) => t.subject === subject) ?? null;
  const customForGrade = (custom.data ?? []).filter((c) => c.grade === g);

  return (
    <div>
      <PageHeader emoji="🗺️" title="Trilhas por Série" subtitle="Organizadas por série, bimestre, unidade temática, habilidade e objeto de conhecimento — Currículo Paulista e BNCC."
        actions={
          <Select value={g} onValueChange={(v) => { setGrade(v); setSubject(null); }}>
            <SelectTrigger className="w-52 bg-card" data-testid="grade-select"><SelectValue>{(v) => GRADE_SHORT[v as string]}</SelectValue></SelectTrigger>
            <SelectContent>
              {Object.entries(GRADE_SHORT).map(([code, label]) => <SelectItem key={code} value={code} data-testid={`grade-option-${code}`}>{label}</SelectItem>)}
            </SelectContent>
          </Select>
        } />

      <p className="text-sm font-semibold text-muted-foreground mb-3" data-testid="curriculum-grade-label">{cur.data?.grade_label ?? GRADE_SHORT[g]}</p>
      {cur.isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3" data-testid="subject-grid">
          {trails.map((t) => (
            <button key={t.subject} type="button" onClick={() => setSubject(t.subject === subject ? null : t.subject)} data-testid={`subject-card-${t.subject}`}
              className={cn("card-tactile hoverable p-4 text-left", subject === t.subject && "ring-2 ring-brand")}>
              <div className="flex items-start justify-between">
                <span className="text-3xl" aria-hidden>{SUBJECT_EMOJI[t.subject] ?? "📘"}</span>
                <ChevronRight className={cn("size-5 text-muted-foreground transition-transform duration-200", subject === t.subject && "rotate-90")} />
              </div>
              <p className="font-heading font-bold mt-2 leading-tight">{t.subject}</p>
              <ProgressBar value={t.accuracy ?? 0} className="h-2 mt-3" tone={t.accuracy !== null && t.accuracy >= 70 ? "bg-success" : "bg-xp"} />
              <p className="text-xs text-muted-foreground mt-1">{t.accuracy !== null ? `${t.accuracy}% de acertos` : "Comece agora"}</p>
            </button>
          ))}
        </div>
      )}

      {active && (
        <section className="mt-8 animate-pop" data-testid="subject-detail">
          <h2 className="text-2xl font-bold mb-4">{SUBJECT_EMOJI[active.subject]} {active.subject} — {GRADE_SHORT[g]}</h2>
          <SubjectPath trail={active} onStart={run} pending={start.isPending} />
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-xl font-bold mb-3 flex items-center gap-2"><Swords className="size-5 text-tutor" /> Quizzes e desafios dos professores</h2>
        {customForGrade.length === 0 ? (
          <EmptyState title="Nenhum quiz publicado para esta série ainda" hint="Os quizzes criados no Painel do Professor aparecem aqui." testid="custom-quizzes-empty" />
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {customForGrade.map((c) => (
              <div key={c.id} className="card-tactile p-4 flex items-center justify-between gap-3" data-testid={`custom-quiz-${c.id}`}>
                <div className="min-w-0">
                  <p className="font-bold truncate">{c.kind === "desafio" ? "⚔️" : "📝"} {c.title}</p>
                  <p className="text-xs text-muted-foreground">{c.subject} · {c.bimestre}º bim · {c.question_count} questões · {c.created_by_name}</p>
                </div>
                <Button size="sm" className="btn-3d" disabled={start.isPending} data-testid={`start-custom-${c.id}`} onClick={() => run({ custom_quiz_id: c.id }, c.title)}>Jogar</Button>
              </div>
            ))}
          </div>
        )}
      </section>
      <PreparingDialog open={!!preparing} label={preparing} />
    </div>
  );
}

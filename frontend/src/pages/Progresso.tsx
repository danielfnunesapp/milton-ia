import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Award, CalendarCheck, Clock, Medal as MedalIcon, Trophy, Users } from "lucide-react";
import { PageHeader, ProgressBar, Skeleton, StatCard, EmptyState } from "@/components/common";
import { apiGet } from "@/lib/api";
import { fmtDate } from "@/lib/hooks";
import type { Medal, Progress } from "@/lib/types";
import { cn } from "@/lib/utils";

function MedalCard({ m }: { m: Medal }) {
  return (
    <div className={cn("card-tactile p-4 text-center", !m.unlocked && "opacity-70")} data-testid={`medal-${m.id}`}>
      <div className={cn("text-4xl", !m.unlocked && "grayscale opacity-50")} aria-hidden>{m.emoji}</div>
      <p className="font-heading font-bold text-sm mt-2">{m.name}</p>
      <p className="text-xs text-muted-foreground mt-0.5 min-h-8">{m.description}</p>
      <ProgressBar value={m.progress * 100} className="h-2 mt-2" tone={m.unlocked ? "bg-success" : "bg-xp"} />
      <p className="text-[11px] mt-1 font-semibold">{m.unlocked ? "Desbloqueada ✓" : `${Math.round(m.progress * 100)}%`}</p>
    </div>
  );
}

function Heat({ xp }: { xp: number }) {
  const lvl = xp === 0 ? "bg-muted" : xp < 30 ? "bg-brand/30" : xp < 80 ? "bg-brand/60" : "bg-brand";
  return <span className={cn("aspect-square rounded-md", lvl)} />;
}

export default function Progresso() {
  const { data: p, isLoading } = useQuery({ queryKey: ["progress"], queryFn: () => apiGet<Progress>("/me/progress") });
  if (isLoading || !p) return <div className="space-y-4"><Skeleton className="h-24" /><Skeleton className="h-64" /></div>;
  return (
    <div>
      <PageHeader emoji="📈" title="Meu Progresso" subtitle={`Nível ${p.level} · ${p.level_name} — veja sua evolução, medalhas e conquistas.`} />
      <div className="card-tactile p-5 mb-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-heading font-bold text-lg" data-testid="progress-level">Nível {p.level} — {p.level_name}</p>
          <p className="text-sm font-semibold text-amber-600 dark:text-xp" data-testid="progress-xp">{p.user.xp} XP · {p.xp_into_level}/{p.xp_for_next} no nível</p>
        </div>
        <ProgressBar value={(100 * p.xp_into_level) / p.xp_for_next} className="h-4 mt-3" tone="bg-xp" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-6">
        <StatCard label="Ranking da turma" value={p.class_rank ? `${p.class_rank}º` : "—"} icon={<Users />} tone="tutor" testid="progress-class-rank" />
        <StatCard label="Ranking da escola" value={p.school_rank ? `${p.school_rank}º` : "—"} icon={<Trophy />} tone="xp" testid="progress-school-rank" />
        <StatCard label="Atividades concluídas" value={p.total_quizzes} icon={<Award />} testid="progress-total-quizzes" />
        <StatCard label="Dias ativos (30d)" value={p.active_days_30} icon={<CalendarCheck />} tone="sky" testid="progress-active-days" />
        <StatCard label="Minutos de estudo" value={p.study_minutes} icon={<Clock />} tone="brand" testid="progress-study-minutes" />
        <StatCard label="Recorde de sequência" value={`${p.user.best_streak}d`} icon={<MedalIcon />} tone="streak" testid="progress-best-streak" />
      </div>

      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-5">
        <div className="card-tactile p-5">
          <p className="font-heading font-bold mb-3">Evolução por disciplina (% de acertos)</p>
          {p.by_subject.length === 0 ? <EmptyState title="Sem dados ainda" hint="Complete um quiz para ver sua evolução." /> : (
            <div className="h-72" data-testid="progress-subject-chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={p.by_subject} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis type="number" domain={[0, 100]} stroke="var(--muted-foreground)" fontSize={12} />
                  <YAxis type="category" dataKey="subject" width={120} stroke="var(--muted-foreground)" fontSize={12} />
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }} />
                  <Bar dataKey="accuracy" name="Acertos (%)" fill="var(--brand)" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
        <div className="card-tactile p-5">
          <p className="font-heading font-bold">Frequência de estudos (35 dias)</p>
          <div className="grid grid-cols-7 gap-1.5 mt-4" data-testid="progress-heatmap">
            {p.frequency.map((f) => <Heat key={f.date} xp={f.xp} />)}
          </div>
          <p className="text-xs text-muted-foreground mt-3">Cada quadrado é um dia — quanto mais verde, mais XP ganho.</p>
          <p className="font-heading font-bold mt-5 mb-2">Últimas atividades</p>
          <ul className="space-y-1.5 text-sm" data-testid="progress-history">
            {p.history.slice(0, 6).map((h, i) => (
              <li key={i} className="flex items-center justify-between gap-2">
                <span className="truncate">{h.title}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{fmtDate(h.date)} · <b className={h.score >= 70 ? "text-success" : "text-amber-600"}>{h.score}%</b></span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <h2 className="text-2xl font-bold mt-8 mb-3">Medalhas</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">{p.medals.map((m) => <MedalCard key={m.id} m={m} />)}</div>
      <h2 className="text-2xl font-bold mt-8 mb-3">Conquistas e sequência de estudos</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">{p.achievements.map((m) => <MedalCard key={m.id} m={m} />)}</div>
    </div>
  );
}

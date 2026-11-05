import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { AlertTriangle, CalendarCheck, Clock, Flame, Star, Swords, TrendingDown, TrendingUp, Trophy, Zap } from "lucide-react";
import { Avatar, EmptyState, PageHeader, ProgressBar, SchoolLogo, Skeleton, StatCard } from "@/components/common";
import { apiGet } from "@/lib/api";
import { useSchool } from "@/lib/hooks";
import { GRADE_SHORT, type ChildSummary } from "@/lib/types";

const WEEKDAY = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function ChildCard({ c }: { c: ChildSummary }) {
  const diff = c.xp_week - c.xp_prev_week;
  const daily = c.daily.map((d) => ({ dia: WEEKDAY[new Date(`${d.date}T12:00:00`).getDay()], xp: d.xp }));
  return (
    <section className="card-tactile p-5 md:p-6 relative overflow-hidden" data-testid={`child-summary-${c.id}`}>
      <div className="absolute inset-x-0 top-0 h-1.5 school-stripe" aria-hidden />
      <div className="flex flex-wrap items-center gap-4">
        <Avatar name={c.name} color={c.avatar_color} size={56} />
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold" data-testid={`child-name-${c.id}`}>{c.name}</h2>
          <p className="text-sm text-muted-foreground">{c.class_name ?? GRADE_SHORT[c.grade ?? ""]} · Nível {c.level} — {c.level_name} · {c.xp} XP no total</p>
        </div>
        <div className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-bold ${diff >= 0 ? "bg-success/15 text-success" : "bg-ruby/15 text-ruby"}`} data-testid={`child-trend-${c.id}`}>
          {diff >= 0 ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
          {diff >= 0 ? "+" : ""}{diff} XP vs. semana anterior
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
        <StatCard label="XP nesta semana" value={c.xp_week} icon={<Zap />} tone="xp" testid={`child-xp-week-${c.id}`} />
        <StatCard label={`Sequência (recorde ${c.best_streak})`} value={`${c.streak} ${c.streak === 1 ? "dia" : "dias"}`} icon={<Flame />} tone="streak" testid={`child-streak-${c.id}`} />
        <StatCard label="Dias ativos (7d)" value={`${c.active_days_week}/7`} icon={<CalendarCheck />} tone="sky" testid={`child-active-days-${c.id}`} />
        <StatCard label="Média nas atividades" value={c.avg_score_week !== null ? `${c.avg_score_week}%` : "—"} icon={<Star />} testid={`child-avg-${c.id}`} />
      </div>

      <div className="grid lg:grid-cols-[1.1fr_1fr] gap-5 mt-5">
        <div>
          <p className="font-heading font-bold text-sm mb-2">XP por dia</p>
          <div className="h-40" data-testid={`child-daily-chart-${c.id}`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={daily}>
                <XAxis dataKey="dia" stroke="var(--muted-foreground)" fontSize={12} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }} />
                <Bar dataKey="xp" name="XP" fill="var(--school)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 mt-2">
            <span className="inline-flex items-center gap-1"><Clock className="size-3.5" /> {c.study_minutes_week} min de estudo</span>
            <span>{c.quizzes_week} atividade(s)</span>
            <span className="inline-flex items-center gap-1"><Trophy className="size-3.5" /> {c.medals_unlocked}/{c.medals_total} conquistas</span>
            <span className="inline-flex items-center gap-1"><Swords className="size-3.5" /> {c.duels_won_week} duelo(s) vencido(s)</span>
          </p>
        </div>
        <div className="space-y-4">
          <div className="rounded-2xl bg-ruby/8 border border-ruby/25 p-4" data-testid={`child-attention-${c.id}`}>
            <p className="font-heading font-bold text-sm flex items-center gap-2"><AlertTriangle className="size-4 text-ruby" /> Precisa de atenção (últimos 30 dias)</p>
            {c.attention.length === 0 ? <p className="text-sm text-muted-foreground mt-1">Nenhuma disciplina abaixo de 60% de acertos. 👏</p> : (
              <div className="mt-2 space-y-2">
                {c.attention.map((s) => (
                  <div key={s.subject} className="text-sm"><div className="flex justify-between"><span>{s.subject}</span><b>{s.accuracy}%</b></div><ProgressBar value={s.accuracy} className="h-2" tone="bg-ruby" /></div>
                ))}
                <p className="text-xs text-muted-foreground">Dica: incentive um Quiz Rápido diário nessas disciplinas ou uma conversa com o Milton I.A Tutor.</p>
              </div>
            )}
          </div>
          {c.strengths.length > 0 && (
            <div className="rounded-2xl bg-success/8 border border-success/25 p-4" data-testid={`child-strengths-${c.id}`}>
              <p className="font-heading font-bold text-sm">⭐ Pontos fortes</p>
              <p className="text-sm mt-1">{c.strengths.map((s) => `${s.subject} (${s.accuracy}%)`).join(" · ")}</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default function Familia() {
  const school = useSchool();
  const { data, isLoading } = useQuery({ queryKey: ["family-summary"], queryFn: () => apiGet<ChildSummary[]>("/family/summary") });
  return (
    <div>
      <div className="flex items-center gap-3 mb-4"><SchoolLogo school={school} size={44} /><p className="text-sm font-bold text-school">{school.name}</p></div>
      <PageHeader emoji="👨‍👩‍👧" title="Resumo semanal da família" subtitle="Acompanhe o XP, a sequência de estudos e as disciplinas que precisam de atenção nos últimos 7 dias." />
      {isLoading ? <Skeleton className="h-96" /> : !data?.length ? <EmptyState title="Nenhum estudante vinculado" hint="Peça à gestão da escola para vincular seu(s) filho(s) à sua conta." testid="family-empty" /> : (
        <div className="space-y-6">{data.map((c) => <ChildCard key={c.id} c={c} />)}</div>
      )}
    </div>
  );
}

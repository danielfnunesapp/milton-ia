import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, EmptyState, PageHeader, Skeleton } from "@/components/common";
import { apiGet } from "@/lib/api";
import { useMe } from "@/lib/hooks";
import { GRADE_SHORT, type RankingEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

const PERIODS = [["daily", "Diário"], ["weekly", "Semanal"], ["monthly", "Mensal"], ["all", "Geral"]] as const;
const PODIUM = ["h-28 bg-xp/25", "h-20 bg-slate-300/40", "h-16 bg-amber-700/20"];

export default function Ranking() {
  const me = useMe();
  const [period, setPeriod] = useState<string>("weekly");
  const [scope, setScope] = useState<string>("school");
  const canClass = !!me.data?.class_id;
  const { data, isLoading } = useQuery({
    queryKey: ["rankings", period, scope],
    queryFn: () => apiGet<RankingEntry[]>(`/rankings?period=${period}&scope=${scope}`),
  });
  const rows = data ?? [];
  const top3 = rows.slice(0, 3);
  const order = [1, 0, 2].filter((i) => top3[i]);

  return (
    <div>
      <PageHeader emoji="🏆" title="Ranking" subtitle="Ganhe XP com quizzes, desafios, conteúdos e participação diária para subir no ranking." />
      <div className="flex flex-wrap gap-3 mb-6">
        <Tabs value={period} onValueChange={(v) => setPeriod(String(v))}>
          <TabsList>{PERIODS.map(([k, l]) => <TabsTrigger key={k} value={k} data-testid={`ranking-period-${k}`}>{l}</TabsTrigger>)}</TabsList>
        </Tabs>
        <Tabs value={scope} onValueChange={(v) => setScope(String(v))}>
          <TabsList>
            <TabsTrigger value="school" data-testid="ranking-scope-school">Escola</TabsTrigger>
            {canClass && <TabsTrigger value="class" data-testid="ranking-scope-class">Minha turma</TabsTrigger>}
          </TabsList>
        </Tabs>
      </div>
      {isLoading ? <Skeleton className="h-80" /> : rows.length === 0 ? <EmptyState title="Ninguém pontuou neste período ainda" /> : (
        <div className="grid lg:grid-cols-[1fr_1.3fr] gap-6">
          <div className="card-tactile p-6 flex items-end justify-center gap-3 dot-grid" data-testid="ranking-podium">
            {order.map((i) => {
              const r = top3[i];
              return (
                <div key={r.user_id} className="flex flex-col items-center w-28 animate-pop">
                  <span className="text-3xl" aria-hidden>{["🥇", "🥈", "🥉"][i]}</span>
                  <Avatar name={r.name} color={r.avatar_color} size={i === 0 ? 64 : 50} />
                  <p className="text-sm font-bold text-center mt-1 leading-tight line-clamp-2">{r.name}</p>
                  <p className="text-xs font-bold text-amber-600 dark:text-xp">{r.xp} XP</p>
                  <div className={cn("w-full rounded-t-2xl mt-2 grid place-items-center font-heading text-2xl font-extrabold", PODIUM[i])}>{i + 1}</div>
                </div>
              );
            })}
          </div>
          <ol className="card-tactile divide-y" data-testid="ranking-list">
            {rows.map((r) => (
              <li key={r.user_id} className={cn("flex items-center gap-3 px-4 py-2.5", r.is_me && "bg-brand/10")} data-testid={`ranking-row-${r.position}`}>
                <span className="w-8 text-center font-heading font-bold text-muted-foreground">{r.position}</span>
                <Avatar name={r.name} color={r.avatar_color} size={34} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{r.name}{r.is_me && <span className="text-brand"> (você)</span>}</p>
                  <p className="text-xs text-muted-foreground">{r.class_name ?? GRADE_SHORT[r.grade ?? ""] ?? ""}</p>
                </div>
                <span className="font-heading font-bold text-amber-600 dark:text-xp">{r.xp} XP</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Bot, Flame, GraduationCap, Images, Map, Target, Trophy, Zap } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Avatar, CountUp, ProgressBar, SchoolLogo, Skeleton } from "@/components/common";
import { apiGet } from "@/lib/api";
import { useSchool } from "@/lib/hooks";
import { GRADE_SHORT, type Progress, type RankingEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

const QUICK = [
  { to: "/trilhas", label: "Trilhas da série", desc: "Quizzes por bimestre", icon: <Map />, tone: "bg-brand/15 text-brand-deep dark:text-brand", id: "trilhas" },
  { to: "/enem", label: "Missão ENEM", desc: "Simulados com cronômetro", icon: <GraduationCap />, tone: "bg-sky/15 text-sky", id: "enem" },
  { to: "/tutor", label: "Milton I.A Tutor", desc: "Tire dúvidas agora", icon: <Bot />, tone: "bg-tutor/15 text-tutor", id: "tutor" },
  { to: "/mural", label: "Mural", desc: "Tirinhas e vídeos", icon: <Images />, tone: "bg-xp/15 text-amber-700 dark:text-xp", id: "mural" },
];

export default function StudentHome() {
  const school = useSchool();
  const prog = useQuery({ queryKey: ["progress"], queryFn: () => apiGet<Progress>("/me/progress") });
  const rank = useQuery({ queryKey: ["rankings", "weekly", "class"], queryFn: () => apiGet<RankingEntry[]>("/rankings?period=weekly&scope=class") });
  const p = prog.data;
  const todayXp = p?.frequency.at(-1)?.xp ?? 0;
  const goal = 50;

  return (
    <div className="space-y-6">
      <section className="grid lg:grid-cols-[1.6fr_1fr] gap-5">
        <div className="card-tactile p-6 md:p-8 relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-2 school-stripe" aria-hidden />
          <div className="absolute -right-10 -top-10 size-48 rounded-full bg-school/15 blur-2xl decor" aria-hidden />
          <div className="flex items-center gap-3">
            <SchoolLogo school={school} size={48} />
            <div className="min-w-0"><p className="text-sm font-bold text-school leading-tight" data-testid="home-school-name">{school.name}</p><p className="text-xs text-muted-foreground">{school.diretoria}</p></div>
          </div>
          {p ? (
            <>
              <h1 className="text-3xl md:text-4xl font-bold mt-4" data-testid="home-greeting">Olá, {p.user.name.split(" ")[0]}! 👋</h1>
              <p className="text-muted-foreground">{GRADE_SHORT[p.user.grade ?? ""] ?? ""} · Nível {p.level} — <span className="font-semibold text-foreground">{p.level_name}</span></p>
              <div className="mt-6 flex items-end gap-6 flex-wrap">
                <div>
                  <div className="text-5xl font-heading font-extrabold text-amber-600 dark:text-xp" data-testid="home-xp-total"><CountUp to={p.user.xp} /> <span className="text-xl">XP</span></div>
                  <p className="text-xs text-muted-foreground">{p.xp_for_next - p.xp_into_level} XP para o nível {p.level + 1}</p>
                </div>
                <div className="flex items-center gap-2 rounded-2xl bg-streak/10 px-4 py-3">
                  <Flame className={cn("size-8 text-streak", p.user.streak > 0 && "animate-flame")} />
                  <div><div className="text-2xl font-heading font-bold" data-testid="home-streak">{p.user.streak} {p.user.streak === 1 ? "dia" : "dias"}</div><div className="text-xs text-muted-foreground">sequência · recorde {p.user.best_streak}</div></div>
                </div>
              </div>
              <ProgressBar value={(100 * p.xp_into_level) / p.xp_for_next} className="mt-5 h-4" tone="bg-xp" testid="home-level-bar" />
            </>
          ) : <Skeleton className="h-40 mt-3" />}
        </div>

        <div className="card-tactile p-6 flex flex-col">
          <p className="font-heading font-bold flex items-center gap-2"><Target className="size-5 text-brand" /> Meta diária</p>
          <p className="text-sm text-muted-foreground">Ganhe {goal} XP hoje para manter o ritmo.</p>
          <div className="my-5 flex items-center gap-4">
            <div className="relative size-24">
              <svg viewBox="0 0 36 36" className="size-24 -rotate-90" aria-hidden>
                <circle cx="18" cy="18" r="15.5" fill="none" strokeWidth="4" className="stroke-muted" />
                <circle cx="18" cy="18" r="15.5" fill="none" strokeWidth="4" strokeLinecap="round" className="stroke-brand transition-[stroke-dashoffset] duration-700"
                  strokeDasharray="97.4" strokeDashoffset={97.4 * (1 - Math.min(1, todayXp / goal))} />
              </svg>
              <span className="absolute inset-0 grid place-items-center font-heading font-bold text-lg" data-testid="home-daily-xp">{todayXp}</span>
            </div>
            <p className="text-sm">{todayXp >= goal ? "Meta batida! 🎉 Continue para subir no ranking." : `Faltam ${goal - todayXp} XP. Um Quiz Rápido resolve!`}</p>
          </div>
          <Link to="/trilhas" className={cn(buttonVariants({ size: "lg" }), "btn-3d mt-auto")} data-testid="home-start-quiz-button"><Zap /> Estudar agora</Link>
        </div>
      </section>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {QUICK.map((q) => (
          <Link key={q.to} to={q.to} className="card-tactile hoverable p-4 flex items-center gap-3" data-testid={`home-quick-${q.id}`}>
            <span className={cn("size-11 rounded-xl grid place-items-center shrink-0", q.tone)}>{q.icon}</span>
            <span className="min-w-0"><span className="block font-bold text-sm">{q.label}</span><span className="block text-xs text-muted-foreground truncate">{q.desc}</span></span>
          </Link>
        ))}
      </section>

      <section className="grid lg:grid-cols-[1fr_1fr] gap-5">
        <div className="card-tactile p-5">
          <div className="flex items-center justify-between">
            <p className="font-heading font-bold">🏅 Medalhas</p>
            <Link to="/progresso" className="text-sm font-semibold text-brand hover:underline" data-testid="home-see-progress-link">Ver progresso</Link>
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 mt-4">
            {(p?.medals ?? []).map((m) => (
              <div key={m.id} title={`${m.name} — ${m.description}`} className={cn("aspect-square rounded-2xl grid place-items-center text-3xl border", m.unlocked ? "bg-xp/10 border-xp/40" : "grayscale opacity-40 bg-muted")} data-testid={`home-medal-${m.id}`}>
                {m.emoji}
              </div>
            ))}
          </div>
        </div>
        <div className="card-tactile p-5">
          <div className="flex items-center justify-between">
            <p className="font-heading font-bold flex items-center gap-2"><Trophy className="size-5 text-xp" /> Ranking semanal da turma</p>
            <Link to="/ranking" className="text-sm font-semibold text-brand hover:underline" data-testid="home-see-ranking-link">Ver tudo</Link>
          </div>
          <ol className="mt-3 space-y-1.5">
            {(rank.data ?? []).slice(0, 5).map((r) => (
              <li key={r.user_id} className={cn("flex items-center gap-3 rounded-xl px-2 py-1.5", r.is_me && "bg-brand/10 ring-1 ring-brand/30")} data-testid={`home-rank-${r.position}`}>
                <span className="w-6 text-center font-heading font-bold">{r.position <= 3 ? ["🥇", "🥈", "🥉"][r.position - 1] : r.position}</span>
                <Avatar name={r.name} color={r.avatar_color} size={30} />
                <span className="flex-1 truncate text-sm font-semibold">{r.name}{r.is_me && " (você)"}</span>
                <span className="text-sm font-bold text-amber-600 dark:text-xp">{r.xp} XP</span>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </div>
  );
}

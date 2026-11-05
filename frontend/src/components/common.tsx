import { useEffect, useState, type ReactNode } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { School } from "@/lib/types";

export function SchoolLogo({ school, size = 40 }: { school: School; size?: number }) {
  const initials = school.name.replace(/^E\.E\.\s*/i, "").split(/\s+/).filter((w) => w.length > 2).slice(0, 2).map((w) => w[0]).join("");
  return school.logo_url ? (
    <img src={school.logo_url} alt={`Logo ${school.name}`} data-testid="school-logo" style={{ width: size, height: size }}
      className="rounded-full object-contain bg-white ring-2 ring-school/30 shrink-0" />
  ) : (
    <div data-testid="school-logo" style={{ width: size, height: size }} aria-label={`Logo ${school.name}`}
      className="rounded-xl bg-school text-white grid place-items-center font-heading font-bold text-sm ring-2 ring-school-yellow/60 shrink-0">
      {initials || "EE"}
    </div>
  );
}

export function MiltonMark({ className, big }: { className?: string; big?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 font-heading font-extrabold tracking-tight", className)} data-testid="milton-brand">
      <span className={cn("relative grid place-items-center rounded-xl bg-tutor text-white", big ? "size-11" : "size-8")}>
        <Sparkles className={big ? "size-6" : "size-4"} aria-hidden />
      </span>
      <span className={big ? "text-4xl md:text-5xl" : "text-xl"}>
        Milton <span className="text-brand">I.A</span>
      </span>
    </span>
  );
}

export function PageHeader({ title, subtitle, emoji, actions }: { title: string; subtitle?: string; emoji?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold" data-testid="page-title">
          {emoji && <span className="mr-2" aria-hidden>{emoji}</span>}
          {title}
        </h1>
        {subtitle && <p className="text-muted-foreground mt-1 max-w-2xl">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, icon, tone = "brand", testid }: { label: string; value: ReactNode; icon: ReactNode; tone?: "brand" | "xp" | "streak" | "tutor" | "sky"; testid: string }) {
  const tones = { brand: "bg-brand/15 text-brand-deep dark:text-brand", xp: "bg-xp/15 text-amber-700 dark:text-xp", streak: "bg-streak/15 text-streak", tutor: "bg-tutor/15 text-tutor", sky: "bg-sky/15 text-sky" };
  return (
    <div className="card-tactile p-4 flex items-center gap-3">
      <div className={cn("size-11 rounded-xl grid place-items-center shrink-0", tones[tone])}>{icon}</div>
      <div className="min-w-0">
        <div className="text-2xl font-heading font-bold leading-none" data-testid={testid}>{value}</div>
        <div className="text-xs text-muted-foreground mt-1">{label}</div>
      </div>
    </div>
  );
}

export function ProgressBar({ value, className, tone = "bg-brand", testid }: { value: number; className?: string; tone?: string; testid?: string }) {
  return (
    <div className={cn("h-3 rounded-full bg-muted overflow-hidden", className)} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100} data-testid={testid}>
      <div className={cn("h-full rounded-full transition-[width] duration-700 ease-out", tone)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function CountUp({ to, duration = 900 }: { to: number; duration?: number }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      setV(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, duration]);
  return <>{v}</>;
}

const CONFETTI = ["#10B981", "#F59E0B", "#6366F1", "#0EA5E9", "#EC4899", "#EF4444"];
export function Confetti() {
  return (
    <div aria-hidden className="decor">
      {Array.from({ length: 40 }).map((_, i) => (
        <span key={i} className="confetti-piece" style={{ left: `${(i * 37) % 100}%`, background: CONFETTI[i % CONFETTI.length], animationDelay: `${(i % 10) * 0.08}s` }} />
      ))}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("shimmer rounded-xl", className)} />;
}

export function EmptyState({ title, hint, testid }: { title: string; hint?: string; testid?: string }) {
  return (
    <div className="card-tactile p-8 text-center dot-grid" data-testid={testid}>
      <p className="font-heading font-semibold text-lg">{title}</p>
      {hint && <p className="text-sm text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

export function Avatar({ name, color, size = 36 }: { name: string; color: string; size?: number }) {
  const ini = name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return (
    <span className="rounded-full grid place-items-center text-white font-bold shrink-0" style={{ background: color, width: size, height: size, fontSize: size * 0.38 }} aria-hidden>
      {ini}
    </span>
  );
}

// Minimal markdown renderer (títulos, listas, negrito) for tutor answers.
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : <span key={i}>{part}</span>,
  );
}
export function Markdown({ text }: { text: string }) {
  return (
    <div className="space-y-1.5 leading-relaxed">
      {text.split("\n").map((raw, i) => {
        const line = raw.replace(/\s+$/, "");
        if (!line.trim()) return <div key={i} className="h-1" />;
        const h = line.match(/^(#{1,4})\s+(.*)/);
        if (h) return <p key={i} className={cn("font-heading font-bold", h[1].length <= 2 ? "text-lg mt-2" : "text-base mt-1")}>{inline(h[2])}</p>;
        const li = line.match(/^(\s*)([-*]|\d+\.)\s+(.*)/);
        if (li) {
          const depth = Math.floor(li[1].length / 2);
          return (
            <div key={i} className="flex gap-2" style={{ paddingLeft: depth * 18 }}>
              <span className="text-brand font-bold shrink-0">{/\d/.test(li[2]) ? li[2] : depth ? "◦" : "•"}</span>
              <span>{inline(li[3])}</span>
            </div>
          );
        }
        return <p key={i}>{inline(line)}</p>;
      })}
    </div>
  );
}

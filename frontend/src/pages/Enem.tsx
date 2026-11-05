import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer } from "recharts";
import { BookText, Calculator, FlaskConical, Globe2, Loader2, PenLine, Timer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader, ProgressBar, StatCard, EmptyState } from "@/components/common";
import { PreparingDialog } from "@/pages/Trilhas";
import { apiGet, apiPost, errorMessage } from "@/lib/api";
import type { Attempt, EnemArea, EnemStartIn, EnemStats, Essay, EssayIn } from "@/lib/types";
import { cn } from "@/lib/utils";

const AREAS: { area: EnemArea; label: string; short: string; icon: React.ReactNode; tone: string }[] = [
  { area: "linguagens", label: "Linguagens, Códigos e suas Tecnologias", short: "Linguagens", icon: <BookText />, tone: "from-sky/25" },
  { area: "matematica", label: "Matemática e suas Tecnologias", short: "Matemática", icon: <Calculator />, tone: "from-brand/25" },
  { area: "natureza", label: "Ciências da Natureza", short: "Natureza", icon: <FlaskConical />, tone: "from-tutor/25" },
  { area: "humanas", label: "Ciências Humanas", short: "Humanas", icon: <Globe2 />, tone: "from-xp/30" },
];
const COUNTS = [5, 10, 20] as const;
const TEMAS = [
  "Desafios para a valorização da herança africana no Brasil",
  "Caminhos para combater a insegurança alimentar no Brasil",
  "Os impactos da desinformação digital na democracia brasileira",
];

function Simulados() {
  const nav = useNavigate();
  const [count, setCount] = useState<5 | 10 | 20>(10);
  const [preparing, setPreparing] = useState("");
  const stats = useQuery({ queryKey: ["enem-stats"], queryFn: () => apiGet<EnemStats>("/enem/stats") });
  const start = useMutation({
    mutationFn: (b: EnemStartIn) => apiPost<Attempt>("/enem/start", b),
    onSuccess: (a) => nav(`/quiz/${a.id}`),
    onError: (e) => toast.error(errorMessage(e)),
    onSettled: () => setPreparing(""),
  });
  const s = stats.data;
  const radar = (s?.areas ?? []).map((a) => ({ area: AREAS.find((x) => x.area === a.area)?.short ?? a.label, acerto: a.accuracy }));

  return (
    <div className="space-y-6">
      <div className="card-tactile p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-heading font-bold text-lg">Monte seu simulado</p>
            <p className="text-sm text-muted-foreground flex items-center gap-1"><Timer className="size-4" /> Cronômetro de 3 minutos por questão · questões no estilo das provas anteriores do ENEM · correção comentada</p>
          </div>
          <div className="flex gap-1 rounded-xl bg-muted p-1" role="radiogroup" aria-label="Quantidade de questões">
            {COUNTS.map((c) => (
              <button key={c} type="button" role="radio" aria-checked={count === c} onClick={() => setCount(c)} data-testid={`enem-count-${c}`}
                className={cn("rounded-lg px-4 py-1.5 text-sm font-bold transition-colors duration-150", count === c ? "bg-card shadow text-foreground" : "text-muted-foreground")}>{c} questões</button>
            ))}
          </div>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
          {AREAS.map((a) => (
            <button key={a.area} type="button" disabled={start.isPending} data-testid={`enem-start-${a.area}`}
              onClick={() => { setPreparing(`Simulado de ${a.short} · ${count} questões`); start.mutate({ area: a.area, count }); }}
              className={cn("card-tactile hoverable p-5 text-left bg-gradient-to-br to-transparent", a.tone)}>
              <span className="size-11 rounded-xl bg-card grid place-items-center">{a.icon}</span>
              <p className="font-heading font-bold mt-3 leading-tight">{a.label}</p>
              <p className="text-xs text-muted-foreground mt-1">{s?.areas.find((x) => x.area === a.area)?.attempts ?? 0} simulado(s) feitos</p>
              <span className="mt-3 inline-block text-sm font-bold text-brand">Iniciar →</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard label="Simulados realizados" value={s?.simulados ?? 0} icon={<Timer />} tone="sky" testid="enem-stat-simulados" />
        <StatCard label="Média de acertos" value={`${s?.avg_score ?? 0}%`} icon={<Calculator />} testid="enem-stat-avg" />
        <StatCard label="Melhor redação" value={s?.best_essay ?? "—"} icon={<PenLine />} tone="tutor" testid="enem-stat-essay" />
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="card-tactile p-5">
          <p className="font-heading font-bold">Mapa de desempenho</p>
          <div className="h-72" data-testid="enem-radar-chart">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radar}>
                <PolarGrid stroke="var(--border)" />
                <PolarAngleAxis dataKey="area" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                <Radar dataKey="acerto" name="% acerto" stroke="var(--tutor)" fill="var(--tutor)" fillOpacity={0.35} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2">
            {(s?.areas ?? []).map((a) => (
              <div key={a.area} className="text-sm"><div className="flex justify-between"><span>{a.label}</span><b>{a.accuracy}%</b></div><ProgressBar value={a.accuracy} className="h-2" tone="bg-tutor" /></div>
            ))}
          </div>
        </div>
        <div className="card-tactile p-5">
          <p className="font-heading font-bold">📅 Plano de estudos da semana</p>
          <p className="text-xs text-muted-foreground">Gerado a partir das suas estatísticas — áreas com menor desempenho vêm primeiro.</p>
          <ol className="mt-4 space-y-2" data-testid="enem-study-plan">
            {(s?.plan ?? []).map((p, i) => (
              <li key={i} className="flex gap-3 rounded-xl bg-muted/60 p-3 text-sm"><span className="size-6 shrink-0 rounded-full bg-brand text-white grid place-items-center text-xs font-bold">{i + 1}</span>{p}</li>
            ))}
          </ol>
        </div>
      </div>
      <PreparingDialog open={!!preparing} label={preparing} />
    </div>
  );
}

function Redacao() {
  const qc = useQueryClient();
  const [tema, setTema] = useState(TEMAS[0]);
  const [texto, setTexto] = useState("");
  const [current, setCurrent] = useState<Essay | null>(null);
  const list = useQuery({ queryKey: ["essays"], queryFn: () => apiGet<Essay[]>("/enem/redacoes") });
  const send = useMutation({
    mutationFn: (b: EssayIn) => apiPost<Essay>("/enem/redacao", b),
    onSuccess: (e) => { setCurrent(e); toast.success(`Redação corrigida: ${e.nota_total} pontos (+30 XP)`); ["essays", "enem-stats", "me", "progress"].forEach((k) => void qc.invalidateQueries({ queryKey: [k] })); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const words = texto.trim() ? texto.trim().split(/\s+/).length : 0;
  const shown = current ?? list.data?.[0] ?? null;

  return (
    <div className="grid lg:grid-cols-[1.2fr_1fr] gap-5">
      <div className="card-tactile p-5 space-y-3">
        <p className="font-heading font-bold text-lg">✍️ Redação modelo ENEM</p>
        <div className="flex flex-wrap gap-2">
          {TEMAS.map((t, i) => <button key={t} type="button" onClick={() => setTema(t)} data-testid={`essay-theme-${i}`} className={cn("rounded-full border px-3 py-1 text-xs font-semibold", tema === t ? "bg-tutor text-white border-tutor" : "hover:bg-muted")}>{t}</button>)}
        </div>
        <Input value={tema} onChange={(e) => setTema(e.target.value)} placeholder="Tema da redação" data-testid="essay-theme-input" />
        <Textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={14} placeholder="Escreva seu texto dissertativo-argumentativo (mínimo de ~7 linhas)…" data-testid="essay-text-input" className="leading-relaxed" />
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground" data-testid="essay-word-count">{words} palavras · {texto.length} caracteres (mín. 200)</span>
          <Button className="btn-3d" disabled={send.isPending || texto.length < 200 || tema.length < 3} onClick={() => send.mutate({ tema, texto })} data-testid="essay-submit-button">
            {send.isPending ? <Loader2 className="animate-spin" /> : <PenLine />} Corrigir com Milton I.A
          </Button>
        </div>
      </div>
      <div className="space-y-4">
        {shown ? (
          <div className="card-tactile p-5" data-testid="essay-result">
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-heading font-bold">Correção por competências</p>
              <p className="text-3xl font-heading font-extrabold text-tutor" data-testid="essay-total-score">{shown.nota_total}<span className="text-base text-muted-foreground">/1000</span></p>
            </div>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">Tema: {shown.tema}</p>
            <div className="mt-4 space-y-3">
              {shown.competencias.map((c) => (
                <div key={c.numero}>
                  <div className="flex justify-between text-sm"><span className="font-semibold">C{c.numero} · {c.nome}</span><b>{c.nota}</b></div>
                  <ProgressBar value={(c.nota / 200) * 100} className="h-2" tone="bg-tutor" />
                  <p className="text-xs text-muted-foreground mt-1">{c.comentario}</p>
                </div>
              ))}
            </div>
            <p className="text-sm mt-4 rounded-lg bg-muted p-3">{shown.comentario_geral}</p>
            <ul className="mt-3 text-sm space-y-1">{shown.sugestoes.map((s) => <li key={s}>💡 {s}</li>)}</ul>
          </div>
        ) : <EmptyState title="Nenhuma redação corrigida ainda" hint="Escreva e envie para receber nota por competência." testid="essay-empty" />}
        {(list.data?.length ?? 0) > 1 && (
          <div className="card-tactile p-4">
            <p className="font-heading font-bold text-sm mb-2">Histórico</p>
            {list.data!.map((e) => <button key={e.id} type="button" onClick={() => setCurrent(e)} className="w-full flex justify-between text-sm py-1 hover:text-brand"><span className="truncate">{e.tema}</span><b>{e.nota_total}</b></button>)}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Enem() {
  return (
    <div>
      <PageHeader emoji="🎓" title="Missão ENEM" subtitle="Linguagens, Matemática, Ciências da Natureza, Ciências Humanas e Redação — simulados cronometrados, estatísticas e plano de estudos." />
      <Tabs defaultValue="simulados">
        <TabsList className="mb-5">
          <TabsTrigger value="simulados" data-testid="enem-tab-simulados">Simulados e estatísticas</TabsTrigger>
          <TabsTrigger value="redacao" data-testid="enem-tab-redacao">Redação</TabsTrigger>
        </TabsList>
        <TabsContent value="simulados"><Simulados /></TabsContent>
        <TabsContent value="redacao"><Redacao /></TabsContent>
      </Tabs>
    </div>
  );
}

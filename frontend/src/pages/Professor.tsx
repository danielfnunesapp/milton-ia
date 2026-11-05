import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ImagePlus, Images, LibraryBig, Loader2, Plus, Save, Sparkles, Trash2, Video } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import FileDrop from "@/components/FileDrop";
import { EmptyState, PageHeader, ProgressBar, Skeleton } from "@/components/common";
import { apiDelete, apiGet, apiPost, errorMessage } from "@/lib/api";
import { fmtDate } from "@/lib/hooks";
import {
  EF_SUBJECTS, EM_SUBJECTS, GRADE_SHORT, subjectsFor, type ClassRoom, type Curriculum, type CustomQuiz, type GroupStat, type QType,
  type QuestionFull, type QuestionImageIn, type ReportOverview, type StudentReport, type TeacherGenerateIn, type TeacherQuizIn, type UploadOut,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const QTYPES: Record<QType, string> = { multiple_choice: "Múltipla escolha", true_false: "Verdadeiro/Falso", complete: "Complete a frase", association: "Associação" };
const blankQ = (): QuestionFull => ({ type: "multiple_choice", statement: "", options: ["", "", "", ""], answer: "", pairs: [{ left: "", right: "" }, { left: "", right: "" }, { left: "", right: "" }], explanation: "", image_url: null });
const ALL_SUBJECTS = Array.from(new Set([...EF_SUBJECTS, ...EM_SUBJECTS]));

function QuestionImageTools({ url, onChange, seed, testid }: { url: string | null; onChange: (u: string | null) => void; seed: string; testid: string }) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const desc = prompt.trim() || seed.trim();
  const gen = useMutation({
    mutationFn: (b: QuestionImageIn) => apiPost<UploadOut>("/teacher/question-image", b),
    onSuccess: (u) => { onChange(u.url); setOpen(false); toast.success("Imagem gerada pela I.A!"); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (url) {
    return (
      <div className="flex items-start gap-2" data-testid={`${testid}-preview`}>
        <img src={url} alt="Imagem da questão" className="max-h-32 rounded-lg border bg-white object-contain p-1" />
        <Button variant="ghost" size="sm" onClick={() => onChange(null)} data-testid={`${testid}-remove`}>Remover imagem</Button>
      </div>
    );
  }
  if (!open) return <Button variant="outline" size="sm" onClick={() => setOpen(true)} data-testid={`${testid}-add`}><ImagePlus /> Imagem (mapa, gráfico, diagrama)</Button>;
  return (
    <div className="space-y-2 rounded-xl bg-muted/60 p-3">
      <FileDrop accept=".jpg,.jpeg,.png,.webp" hint="Envie um mapa, gráfico ou diagrama (JPG, PNG, WEBP)" testid={`${testid}-drop`} onUploaded={(u) => { onChange(u.url); setOpen(false); }} />
      <div className="flex gap-2">
        <Input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="…ou descreva para a I.A: ex. mapa do Brasil com os biomas" data-testid={`${testid}-prompt`} />
        <Button className="bg-tutor hover:bg-tutor/90 text-white shrink-0" disabled={gen.isPending || desc.length < 5} onClick={() => gen.mutate({ prompt: desc })} data-testid={`${testid}-generate`}>
          {gen.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />} Gerar
        </Button>
      </div>
    </div>
  );
}

function ManualQuestion({ onAdd }: { onAdd: (q: QuestionFull) => void }) {
  const [q, setQ] = useState<QuestionFull>(blankQ);
  const opts = q.type === "true_false" ? ["Verdadeiro", "Falso"] : q.options;
  const valid = q.statement.trim().length > 3 && (q.type === "association" ? q.pairs.filter((p) => p.left && p.right).length >= 2 : opts.filter(Boolean).length >= 2 && opts.includes(q.answer) && !!q.answer);
  const add = () => {
    onAdd(q.type === "association" ? { ...q, options: [], answer: "", pairs: q.pairs.filter((p) => p.left && p.right) } : { ...q, options: opts.filter(Boolean), pairs: [] });
    setQ(blankQ());
  };
  return (
    <div className="rounded-2xl border-2 border-dashed p-4 space-y-3" data-testid="manual-question-form">
      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(QTYPES) as QType[]).map((t) => (
          <button key={t} type="button" onClick={() => setQ({ ...q, type: t, answer: "" })} data-testid={`manual-type-${t}`} className={cn("rounded-full border px-3 py-1 text-xs font-bold", q.type === t ? "bg-tutor text-white border-tutor" : "hover:bg-muted")}>{QTYPES[t]}</button>
        ))}
      </div>
      <Textarea value={q.statement} onChange={(e) => setQ({ ...q, statement: e.target.value })} placeholder={q.type === "complete" ? "Enunciado com a lacuna _____" : "Enunciado da questão"} data-testid="manual-statement-input" />
      {q.type === "association" ? (
        <div className="space-y-2">
          {q.pairs.map((p, i) => (
            <div key={i} className="grid grid-cols-2 gap-2">
              <Input value={p.left} placeholder={`Conceito ${i + 1}`} data-testid={`manual-pair-left-${i}`} onChange={(e) => setQ({ ...q, pairs: q.pairs.map((x, j) => (j === i ? { ...x, left: e.target.value } : x)) })} />
              <Input value={p.right} placeholder={`Definição ${i + 1}`} data-testid={`manual-pair-right-${i}`} onChange={(e) => setQ({ ...q, pairs: q.pairs.map((x, j) => (j === i ? { ...x, right: e.target.value } : x)) })} />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {opts.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <input type="radio" name="manual-answer" checked={!!o && q.answer === o} onChange={() => setQ({ ...q, answer: o })} aria-label={`Marcar opção ${i + 1} como correta`} data-testid={`manual-answer-radio-${i}`} className="size-4 accent-[var(--brand)]" />
              {q.type === "true_false" ? <span className="text-sm font-semibold">{o}</span> : (
                <Input value={o} placeholder={`Opção ${i + 1}`} data-testid={`manual-option-${i}`}
                  onChange={(e) => setQ({ ...q, options: q.options.map((x, j) => (j === i ? e.target.value : x)), answer: q.answer === o ? e.target.value : q.answer })} />
              )}
            </div>
          ))}
          <p className="text-xs text-muted-foreground">Marque a alternativa correta.</p>
        </div>
      )}
      <Input value={q.explanation} onChange={(e) => setQ({ ...q, explanation: e.target.value })} placeholder="Correção comentada (explicação)" data-testid="manual-explanation-input" />
      <QuestionImageTools url={q.image_url} onChange={(u) => setQ({ ...q, image_url: u })} seed={q.statement} testid="manual-image" />
      <Button variant="secondary" disabled={!valid} onClick={add} data-testid="manual-add-question-button"><Plus /> Adicionar questão</Button>
    </div>
  );
}

function CreateQuiz() {
  const qc = useQueryClient();
  const [grade, setGrade] = useState("9EF");
  const [subject, setSubject] = useState("Matemática");
  const [bimestre, setBimestre] = useState(1);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<"quiz" | "desafio">("quiz");
  const [questions, setQuestions] = useState<QuestionFull[]>([]);
  const cur = useQuery({ queryKey: ["curriculum", grade], queryFn: () => apiGet<Curriculum>(`/curriculum/${grade}`) });
  const topic = cur.data?.subjects.find((s) => s.subject === subject)?.topics[bimestre - 1];
  const gen = useMutation({
    mutationFn: (b: TeacherGenerateIn) => apiPost<QuestionFull[]>("/teacher/generate", b),
    onSuccess: (qs) => { setQuestions((p) => [...p, ...qs]); toast.success(`${qs.length} questões geradas pela I.A`); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const save = useMutation({
    mutationFn: (b: TeacherQuizIn) => apiPost<CustomQuiz>("/teacher/quizzes", b),
    onSuccess: () => { toast.success("Quiz publicado para os estudantes!"); setQuestions([]); setTitle(""); void qc.invalidateQueries({ queryKey: ["custom-quizzes"] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <div className="grid lg:grid-cols-[1fr_1.2fr] gap-5">
      <div className="card-tactile p-5 space-y-3 h-fit">
        <p className="font-heading font-bold text-lg">Configurar atividade</p>
        <div className="space-y-1"><Label>Título</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Desafio de Equações" data-testid="teacher-quiz-title-input" /></div>
        <div className="flex gap-2">
          {(["quiz", "desafio"] as const).map((k) => <Button key={k} variant={kind === k ? "default" : "outline"} size="sm" onClick={() => setKind(k)} data-testid={`teacher-kind-${k}`}>{k === "quiz" ? "📝 Quiz" : "⚔️ Desafio"}</Button>)}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Select value={grade} onValueChange={(v) => { setGrade(v); if (!subjectsFor(v).includes(subject)) setSubject("Matemática"); }}>
            <SelectTrigger data-testid="teacher-grade-select"><SelectValue>{(v) => GRADE_SHORT[v as string]}</SelectValue></SelectTrigger>
            <SelectContent>{Object.entries(GRADE_SHORT).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={subject} onValueChange={setSubject}>
            <SelectTrigger data-testid="teacher-subject-select"><SelectValue /></SelectTrigger>
            <SelectContent>{subjectsFor(grade).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={String(bimestre)} onValueChange={(v) => setBimestre(Number(v))}>
            <SelectTrigger data-testid="teacher-bimestre-select"><SelectValue>{(v) => `${v as string}º bimestre`}</SelectValue></SelectTrigger>
            <SelectContent>{[1, 2, 3, 4].map((b) => <SelectItem key={b} value={String(b)}>{b}º bimestre</SelectItem>)}</SelectContent>
          </Select>
        </div>
        {topic && (
          <div className="rounded-xl bg-muted p-3 text-sm" data-testid="teacher-topic-info">
            <p><b>Habilidade:</b> <span className="font-mono">{topic.habilidade}</span></p>
            <p><b>Unidade temática:</b> {topic.unidade}</p>
            <p><b>Objeto de conhecimento:</b> {topic.objeto}</p>
          </div>
        )}
        <Button className="w-full bg-tutor hover:bg-tutor/90 text-white btn-3d" disabled={gen.isPending} onClick={() => gen.mutate({ grade, subject, bimestre, count: 5 })} data-testid="teacher-generate-ai-button">
          {gen.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />} Gerar 5 questões com I.A
        </Button>
        <ManualQuestion onAdd={(q) => setQuestions((p) => [...p, q])} />
      </div>
      <div className="card-tactile p-5">
        <div className="flex items-center justify-between gap-2 mb-3">
          <p className="font-heading font-bold text-lg">Questões ({questions.length})</p>
          <Button className="btn-3d" disabled={!questions.length || title.length < 2 || save.isPending} data-testid="teacher-save-quiz-button"
            onClick={() => save.mutate({ title, kind, grade, subject, bimestre, questions })}><Save /> Publicar</Button>
        </div>
        {questions.length === 0 ? <EmptyState title="Nenhuma questão ainda" hint="Gere com I.A ou adicione manualmente." testid="teacher-questions-empty" /> : (
          <ol className="space-y-3" data-testid="teacher-questions-list">
            {questions.map((q, i) => (
              <li key={i} className="rounded-xl border p-3" data-testid={`teacher-question-${i}`}>
                <div className="flex items-start justify-between gap-2">
                  <div><Badge variant="secondary">{QTYPES[q.type]}</Badge><p className="font-semibold mt-1.5 text-sm whitespace-pre-line">{i + 1}. {q.statement}</p></div>
                  <Button variant="ghost" size="icon-sm" aria-label="Remover questão" onClick={() => setQuestions((p) => p.filter((_, j) => j !== i))} data-testid={`teacher-question-remove-${i}`}><Trash2 /></Button>
                </div>
                <ul className="mt-2 text-sm space-y-0.5">
                  {q.type === "association" ? q.pairs.map((p) => <li key={p.left}>• {p.left} → <b>{p.right}</b></li>)
                    : q.options.map((o) => <li key={o} className={cn(o === q.answer && "text-success font-bold")}>{o === q.answer ? "✓" : "•"} {o}</li>)}
                </ul>
                {q.explanation && <p className="text-xs text-muted-foreground mt-2">💡 {q.explanation}</p>}
                <div className="mt-2"><QuestionImageTools url={q.image_url} seed={q.statement} testid={`teacher-question-image-${i}`}
                  onChange={(u) => setQuestions((p) => p.map((x, j) => (j === i ? { ...x, image_url: u } : x)))} /></div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

function MyQuizzes() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["custom-quizzes"], queryFn: () => apiGet<CustomQuiz[]>("/custom-quizzes") });
  const del = useMutation({ mutationFn: (id: string) => apiDelete(`/teacher/quizzes/${id}`), onSuccess: () => { toast.success("Quiz removido"); void qc.invalidateQueries({ queryKey: ["custom-quizzes"] }); } });
  if (list.isLoading) return <Skeleton className="h-40" />;
  if (!list.data?.length) return <EmptyState title="Nenhum quiz publicado" testid="my-quizzes-empty" />;
  return (
    <div className="grid md:grid-cols-2 gap-3">
      {list.data.map((c) => (
        <div key={c.id} className="card-tactile p-4 flex items-center justify-between gap-3" data-testid={`my-quiz-${c.id}`}>
          <div className="min-w-0">
            <p className="font-bold truncate">{c.kind === "desafio" ? "⚔️" : "📝"} {c.title}</p>
            <p className="text-xs text-muted-foreground">{GRADE_SHORT[c.grade]} · {c.subject} · {c.bimestre}º bim · {c.question_count} questões · {fmtDate(c.created_at)}</p>
          </div>
          <Button variant="ghost" size="icon-sm" aria-label="Remover" onClick={() => del.mutate(c.id)} data-testid={`my-quiz-delete-${c.id}`}><Trash2 /></Button>
        </div>
      ))}
    </div>
  );
}

export function GroupChart({ data, testid }: { data: GroupStat[]; testid: string }) {
  if (!data.length) return <EmptyState title="Sem dados para este filtro" />;
  return (
    <div className="h-80" data-testid={testid}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={11} interval={0} angle={-20} textAnchor="end" height={60} />
          <YAxis domain={[0, 100]} stroke="var(--muted-foreground)" fontSize={12} />
          <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }} />
          <Bar dataKey="avg_score" name="Desempenho médio (%)" fill="var(--brand)" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function Reports() {
  const [grade, setGrade] = useState("all");
  const [classId, setClassId] = useState("all");
  const [subject, setSubject] = useState("all");
  const [student, setStudent] = useState<string | null>(null);
  const classes = useQuery({ queryKey: ["classes"], queryFn: () => apiGet<ClassRoom[]>("/classes") });
  const qs = new URLSearchParams({ grade: grade === "all" ? "" : grade, class_id: classId === "all" ? "" : classId, subject: subject === "all" ? "" : subject }).toString();
  const rep = useQuery({ queryKey: ["reports", qs], queryFn: () => apiGet<ReportOverview>(`/reports/overview?${qs}`) });
  const detail = useQuery({ queryKey: ["report-student", student], queryFn: () => apiGet<StudentReport>(`/reports/student/${student}`), enabled: !!student });
  const className = (id: string) => classes.data?.find((c) => c.id === id)?.name ?? "";

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        <Select value={grade} onValueChange={setGrade}>
          <SelectTrigger className="w-44 bg-card" data-testid="report-grade-filter"><SelectValue>{(v) => (v === "all" ? "Todas as séries" : GRADE_SHORT[v as string])}</SelectValue></SelectTrigger>
          <SelectContent><SelectItem value="all">Todas as séries</SelectItem>{Object.entries(GRADE_SHORT).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={classId} onValueChange={setClassId}>
          <SelectTrigger className="w-44 bg-card" data-testid="report-class-filter"><SelectValue>{(v) => (v === "all" ? "Todas as turmas" : className(v as string))}</SelectValue></SelectTrigger>
          <SelectContent><SelectItem value="all">Todas as turmas</SelectItem>{(classes.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={subject} onValueChange={setSubject}>
          <SelectTrigger className="w-48 bg-card" data-testid="report-subject-filter"><SelectValue>{(v) => (v === "all" ? "Todas as disciplinas" : (v as string))}</SelectValue></SelectTrigger>
          <SelectContent><SelectItem value="all">Todas as disciplinas</SelectItem>{ALL_SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      {rep.isLoading || !rep.data ? <Skeleton className="h-80" /> : (
        <Tabs defaultValue="individual">
          <TabsList className="mb-4">
            <TabsTrigger value="individual" data-testid="report-tab-individual">Individual</TabsTrigger>
            <TabsTrigger value="turma" data-testid="report-tab-turma">Turma</TabsTrigger>
            <TabsTrigger value="serie" data-testid="report-tab-serie">Série</TabsTrigger>
            <TabsTrigger value="disciplina" data-testid="report-tab-disciplina">Disciplina</TabsTrigger>
          </TabsList>
          <TabsContent value="individual">
            <div className="card-tactile overflow-hidden">
              <Table data-testid="report-students-table">
                <TableHeader><TableRow><TableHead>Estudante</TableHead><TableHead>Turma</TableHead><TableHead className="text-right">XP</TableHead><TableHead className="text-right">Atividades</TableHead><TableHead className="w-40">Média</TableHead></TableRow></TableHeader>
                <TableBody>
                  {rep.data.students.map((s) => (
                    <TableRow key={s.id} className="cursor-pointer" onClick={() => setStudent(s.id)} data-testid={`report-student-row-${s.id}`}>
                      <TableCell className="font-semibold">{s.name}</TableCell>
                      <TableCell>{s.class_name ?? GRADE_SHORT[s.grade ?? ""]}</TableCell>
                      <TableCell className="text-right">{s.xp}</TableCell>
                      <TableCell className="text-right">{s.attempts}</TableCell>
                      <TableCell>{s.avg_score !== null ? <div className="flex items-center gap-2"><ProgressBar value={s.avg_score} className="h-2 flex-1" tone={s.avg_score >= 70 ? "bg-success" : "bg-xp"} /><span className="text-xs font-bold w-9">{s.avg_score}%</span></div> : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
          <TabsContent value="turma"><div className="card-tactile p-5"><GroupChart data={rep.data.by_class} testid="report-class-chart" /></div></TabsContent>
          <TabsContent value="serie"><div className="card-tactile p-5"><GroupChart data={rep.data.by_grade} testid="report-grade-chart" /></div></TabsContent>
          <TabsContent value="disciplina"><div className="card-tactile p-5"><GroupChart data={rep.data.by_subject} testid="report-subject-chart" /></div></TabsContent>
        </Tabs>
      )}
      <Dialog open={!!student} onOpenChange={(v) => !v && setStudent(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90dvh] overflow-y-auto" data-testid="report-student-dialog">
          <DialogHeader><DialogTitle>{detail.data?.student.name ?? "Relatório individual"}</DialogTitle></DialogHeader>
          {detail.data ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{detail.data.student.class_name} · {detail.data.student.xp} XP · 🔥 {detail.data.student.streak} dias · média {detail.data.student.avg_score ?? "—"}%</p>
              <div className="space-y-2">{detail.data.by_subject.map((s) => <div key={s.subject} className="text-sm"><div className="flex justify-between"><span>{s.subject} ({s.attempts})</span><b>{s.accuracy}%</b></div><ProgressBar value={s.accuracy} className="h-2" /></div>)}</div>
              <div><p className="font-heading font-bold text-sm mb-1">Histórico recente</p>{detail.data.history.map((h, i) => <p key={i} className="text-sm flex justify-between"><span className="truncate">{h.title}</span><span>{fmtDate(h.date)} · <b>{h.score}%</b></span></p>)}</div>
            </div>
          ) : <Skeleton className="h-40" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function Professor() {
  return (
    <div>
      <PageHeader emoji="🧑‍🏫" title="Painel do Professor" subtitle="Crie quizzes e desafios, publique materiais e mídias e acompanhe o desempenho das turmas." />
      <div className="grid sm:grid-cols-3 gap-3 mb-6">
        <Link to="/mural" className="card-tactile hoverable p-4 flex items-center gap-3" data-testid="teacher-link-mural"><Images className="text-xp" /><span className="font-bold text-sm">Publicar tirinhas e imagens</span></Link>
        <Link to="/mural" className="card-tactile hoverable p-4 flex items-center gap-3" data-testid="teacher-link-videos"><Video className="text-ruby" /><span className="font-bold text-sm">Publicar vídeos curtos</span></Link>
        <Link to="/biblioteca" className="card-tactile hoverable p-4 flex items-center gap-3" data-testid="teacher-link-library"><LibraryBig className="text-sky" /><span className="font-bold text-sm">Publicar materiais</span></Link>
      </div>
      <Tabs defaultValue="criar">
        <TabsList className="mb-5">
          <TabsTrigger value="criar" data-testid="teacher-tab-create">Criar quiz / desafio</TabsTrigger>
          <TabsTrigger value="meus" data-testid="teacher-tab-mine">Meus quizzes</TabsTrigger>
          <TabsTrigger value="relatorios" data-testid="teacher-tab-reports">Relatórios</TabsTrigger>
        </TabsList>
        <TabsContent value="criar"><CreateQuiz /></TabsContent>
        <TabsContent value="meus"><MyQuizzes /></TabsContent>
        <TabsContent value="relatorios"><Reports /></TabsContent>
      </Tabs>
    </div>
  );
}

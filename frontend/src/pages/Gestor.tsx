import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Area, AreaChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, BookOpen, Clock, GraduationCap, Images, LibraryBig, Percent, Plus, School as SchoolIcon, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import FileDrop from "@/components/FileDrop";
import { PageHeader, SchoolLogo, Skeleton, StatCard } from "@/components/common";
import { GroupChart } from "@/pages/Professor";
import { apiDelete, apiGet, apiPost, apiPut, errorMessage } from "@/lib/api";
import { fmtDate, useSchool } from "@/lib/hooks";
import { GRADE_SHORT, ROLE_LABEL, type ClassIn, type ClassRoom, type Dashboard, type Role, type School, type User, type UserIn } from "@/lib/types";

const LINES = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
const TT = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 };

function DashboardTab() {
  const { data: d } = useQuery({ queryKey: ["dashboard"], queryFn: () => apiGet<Dashboard>("/admin/dashboard") });
  if (!d) return <Skeleton className="h-96" />;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <StatCard label="Estudantes" value={d.total_students} icon={<GraduationCap />} testid="kpi-students" />
        <StatCard label="Professores" value={d.total_teachers} icon={<BookOpen />} tone="tutor" testid="kpi-teachers" />
        <StatCard label="Turmas" value={d.total_classes} icon={<Users />} tone="sky" testid="kpi-classes" />
        <StatCard label="Participação (7d)" value={`${d.participation_rate}%`} icon={<Activity />} tone="streak" testid="kpi-participation" />
        <StatCard label="Desempenho médio" value={`${d.avg_score}%`} icon={<Percent />} tone="xp" testid="kpi-avg-score" />
        <StatCard label="Horas de estudo" value={d.study_hours} icon={<Clock />} testid="kpi-study-hours" />
      </div>
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="card-tactile p-5">
          <p className="font-heading font-bold mb-3">Acesso diário (14 dias)</p>
          <div className="h-64" data-testid="chart-daily-access">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={d.daily_access.map((x) => ({ ...x, dia: fmtDate(x.date).slice(0, 5) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="dia" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis allowDecimals={false} stroke="var(--muted-foreground)" fontSize={11} />
                <Tooltip contentStyle={TT} />
                <Area dataKey="count" name="Acessos" stroke="var(--brand)" fill="var(--brand)" fillOpacity={0.25} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card-tactile p-5">
          <p className="font-heading font-bold mb-3">Evolução por componente curricular (% médio por semana)</p>
          <div className="h-64" data-testid="chart-evolution">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={d.evolution}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="semana" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis domain={[0, 100]} stroke="var(--muted-foreground)" fontSize={11} />
                <Tooltip contentStyle={TT} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {d.evolution_subjects.map((s, i) => <Line key={s} dataKey={s} stroke={LINES[i % LINES.length]} strokeWidth={2.5} dot={false} connectNulls />)}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      <div className="card-tactile p-5">
        <p className="font-heading font-bold mb-3">Desempenho médio por disciplina</p>
        <GroupChart data={d.subject_performance} testid="chart-subject-performance" />
      </div>
    </div>
  );
}

const EMPTY_USER: UserIn = { name: "", email: "", password: "", role: "student", grade: "6EF", class_id: null, children_ids: [] };

function UsersTab() {
  const qc = useQueryClient();
  const [role, setRole] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<UserIn>(EMPTY_USER);
  const [childQ, setChildQ] = useState("");
  const users = useQuery({ queryKey: ["admin-users", role], queryFn: () => apiGet<User[]>(`/admin/users?role=${role}`) });
  const students = useQuery({ queryKey: ["admin-users", "student"], queryFn: () => apiGet<User[]>("/admin/users?role=student"), enabled: open && f.role === "guardian" });
  const classes = useQuery({ queryKey: ["classes"], queryFn: () => apiGet<ClassRoom[]>("/classes") });
  const create = useMutation({
    mutationFn: (b: UserIn) => apiPost<User>("/admin/users", b),
    onSuccess: () => { toast.success("Usuário criado"); setOpen(false); setF(EMPTY_USER); ["admin-users", "classes", "dashboard"].forEach((k) => void qc.invalidateQueries({ queryKey: [k] })); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const del = useMutation({
    mutationFn: (id: string) => apiDelete(`/admin/users/${id}`),
    onSuccess: () => { toast.success("Usuário removido"); ["admin-users", "classes"].forEach((k) => void qc.invalidateQueries({ queryKey: [k] })); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const cname = (id: string | null) => classes.data?.find((c) => c.id === id)?.name ?? "—";
  const gradeClasses = (classes.data ?? []).filter((c) => c.grade === f.grade);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <Tabs value={role || "all"} onValueChange={(v) => setRole(v === "all" ? "" : String(v))}>
          <TabsList>
            <TabsTrigger value="all" data-testid="users-filter-all">Todos</TabsTrigger>
            <TabsTrigger value="student" data-testid="users-filter-student">Estudantes</TabsTrigger>
            <TabsTrigger value="teacher" data-testid="users-filter-teacher">Professores</TabsTrigger>
            <TabsTrigger value="manager" data-testid="users-filter-manager">Gestores</TabsTrigger>
            <TabsTrigger value="guardian" data-testid="users-filter-guardian">Responsáveis</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button className="btn-3d" onClick={() => setOpen(true)} data-testid="user-new-button"><Plus /> Novo usuário</Button>
      </div>
      <div className="card-tactile overflow-hidden">
        <Table data-testid="users-table">
          <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>E-mail</TableHead><TableHead>Perfil</TableHead><TableHead>Turma</TableHead><TableHead className="text-right">XP</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {(users.data ?? []).map((u) => (
              <TableRow key={u.id} data-testid={`user-row-${u.id}`}>
                <TableCell className="font-semibold">{u.name}</TableCell>
                <TableCell className="text-muted-foreground">{u.email}</TableCell>
                <TableCell><Badge variant="secondary">{ROLE_LABEL[u.role]}</Badge></TableCell>
                <TableCell>{u.role === "student" ? `${cname(u.class_id)} · ${GRADE_SHORT[u.grade ?? ""] ?? ""}` : u.role === "guardian" ? `${u.children_ids.length} estudante(s) vinculado(s)` : "—"}</TableCell>
                <TableCell className="text-right">{u.role === "student" ? u.xp : "—"}</TableCell>
                <TableCell className="text-right"><Button variant="ghost" size="icon-sm" aria-label="Remover usuário" onClick={() => del.mutate(u.id)} data-testid={`user-delete-${u.id}`}><Trash2 /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-testid="user-dialog">
          <DialogHeader><DialogTitle>Novo usuário</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Nome</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} data-testid="user-name-input" /></div>
            <div className="space-y-1"><Label>E-mail</Label><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} data-testid="user-email-input" /></div>
            <div className="space-y-1"><Label>Senha inicial</Label><Input value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} placeholder="mínimo 6 caracteres" data-testid="user-password-input" /></div>
            <Select value={f.role} onValueChange={(v) => setF({ ...f, role: v as Role })}>
              <SelectTrigger data-testid="user-role-select"><SelectValue>{(v) => ROLE_LABEL[v as Role]}</SelectValue></SelectTrigger>
              <SelectContent>{(Object.keys(ROLE_LABEL) as Role[]).map((r) => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}</SelectContent>
            </Select>
            {f.role === "guardian" && (
              <div className="space-y-2" data-testid="guardian-children-picker">
                <Label>Estudantes vinculados ({f.children_ids.length})</Label>
                <Input value={childQ} onChange={(e) => setChildQ(e.target.value)} placeholder="Buscar estudante…" data-testid="guardian-children-search" />
                <div className="max-h-40 overflow-y-auto rounded-lg border divide-y">
                  {(students.data ?? []).filter((s) => s.name.toLowerCase().includes(childQ.toLowerCase())).map((s) => (
                    <label key={s.id} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-muted">
                      <input type="checkbox" className="size-4 accent-[var(--brand)]" checked={f.children_ids.includes(s.id)} data-testid={`guardian-child-${s.id}`}
                        onChange={(e) => setF({ ...f, children_ids: e.target.checked ? [...f.children_ids, s.id] : f.children_ids.filter((x) => x !== s.id) })} />
                      {s.name} <span className="text-xs text-muted-foreground">· {GRADE_SHORT[s.grade ?? ""]}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            {f.role === "student" && (
              <div className="grid grid-cols-2 gap-2">
                <Select value={f.grade ?? "6EF"} onValueChange={(v) => setF({ ...f, grade: v, class_id: null })}>
                  <SelectTrigger data-testid="user-grade-select"><SelectValue>{(v) => GRADE_SHORT[v as string]}</SelectValue></SelectTrigger>
                  <SelectContent>{Object.entries(GRADE_SHORT).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={f.class_id ?? "none"} onValueChange={(v) => setF({ ...f, class_id: v === "none" ? null : v })}>
                  <SelectTrigger data-testid="user-class-select"><SelectValue>{(v) => (v === "none" ? "Sem turma" : cname(v as string))}</SelectValue></SelectTrigger>
                  <SelectContent><SelectItem value="none">Sem turma</SelectItem>{gradeClasses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter><Button disabled={create.isPending || f.name.length < 2 || f.password.length < 6 || !f.email || (f.role === "guardian" && !f.children_ids.length)} onClick={() => create.mutate(f)} data-testid="user-save-button">Criar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ClassesTab() {
  const qc = useQueryClient();
  const [f, setF] = useState<ClassIn>({ name: "", grade: "6EF" });
  const classes = useQuery({ queryKey: ["classes"], queryFn: () => apiGet<ClassRoom[]>("/classes") });
  const create = useMutation({
    mutationFn: (b: ClassIn) => apiPost<ClassRoom>("/admin/classes", b),
    onSuccess: () => { toast.success("Turma criada"); setF({ ...f, name: "" }); void qc.invalidateQueries({ queryKey: ["classes"] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const del = useMutation({ mutationFn: (id: string) => apiDelete(`/admin/classes/${id}`), onSuccess: () => { toast.success("Turma removida"); void qc.invalidateQueries({ queryKey: ["classes"] }); } });
  return (
    <div className="space-y-4">
      <div className="card-tactile p-4 flex flex-wrap gap-2 items-end">
        <div className="space-y-1 flex-1 min-w-48"><Label>Nome da turma</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Ex.: 7º B" data-testid="class-name-input" /></div>
        <Select value={f.grade} onValueChange={(v) => setF({ ...f, grade: v })}>
          <SelectTrigger className="w-44" data-testid="class-grade-select"><SelectValue>{(v) => GRADE_SHORT[v as string]}</SelectValue></SelectTrigger>
          <SelectContent>{Object.entries(GRADE_SHORT).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
        </Select>
        <Button className="btn-3d" disabled={!f.name || create.isPending} onClick={() => create.mutate(f)} data-testid="class-save-button"><Plus /> Criar turma</Button>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {(classes.data ?? []).map((c) => (
          <div key={c.id} className="card-tactile p-4 flex items-center justify-between" data-testid={`class-card-${c.id}`}>
            <div><p className="font-heading font-bold text-lg">{c.name}</p><p className="text-xs text-muted-foreground">{GRADE_SHORT[c.grade]} · {c.students} estudante(s)</p></div>
            <Button variant="ghost" size="icon-sm" aria-label="Remover turma" onClick={() => del.mutate(c.id)} data-testid={`class-delete-${c.id}`}><Trash2 /></Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function SchoolTab() {
  const qc = useQueryClient();
  const school = useSchool();
  const [f, setF] = useState<School | null>(null);
  const cur = f ?? school;
  const save = useMutation({
    mutationFn: (b: School) => apiPut<School>("/admin/school", b),
    onSuccess: () => { toast.success("Identidade da escola atualizada"); setF(null); void qc.invalidateQueries({ queryKey: ["school"] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <div className="grid lg:grid-cols-[1.2fr_1fr] gap-5">
      <div className="card-tactile p-5 space-y-3">
        <div className="space-y-1"><Label>Nome da escola</Label><Input value={cur.name} onChange={(e) => setF({ ...cur, name: e.target.value })} data-testid="school-name-input" /></div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1"><Label>Cidade</Label><Input value={cur.city} onChange={(e) => setF({ ...cur, city: e.target.value })} data-testid="school-city-input" /></div>
          <div className="space-y-1"><Label>Diretoria de Ensino</Label><Input value={cur.diretoria} onChange={(e) => setF({ ...cur, diretoria: e.target.value })} data-testid="school-diretoria-input" /></div>
        </div>
        <Label>Logo da escola</Label>
        <FileDrop accept=".png,.jpg,.jpeg,.webp" hint="PNG, JPG ou WEBP — fundo transparente recomendado" testid="school-logo-drop" onUploaded={(u) => setF({ ...cur, logo_url: u.url })} />
        <div className="flex gap-2">
          <Button className="btn-3d" disabled={!f || save.isPending || cur.name.length < 2} onClick={() => save.mutate(cur)} data-testid="school-save-button">Salvar identidade</Button>
          {cur.logo_url && <Button variant="outline" onClick={() => setF({ ...cur, logo_url: null })} data-testid="school-remove-logo-button">Remover logo</Button>}
        </div>
      </div>
      <div className="card-tactile p-6 bg-brand-deep text-white" data-testid="school-preview">
        <p className="text-xs uppercase tracking-wider text-white/70">Pré-visualização da tela inicial</p>
        <div className="flex items-center gap-3 mt-4"><SchoolLogo school={cur} size={56} /><div><p className="font-heading font-bold text-lg">{cur.name}</p><p className="text-sm text-white/80">{cur.city}</p></div></div>
        <p className="font-heading text-4xl font-extrabold mt-6">Milton <span className="text-emerald-300">I.A</span></p>
      </div>
    </div>
  );
}

export default function Gestor() {
  return (
    <div>
      <PageHeader emoji="🏫" title="Painel do Gestor" subtitle="Indicadores da escola, usuários, turmas, professores, conteúdos e identidade visual." />
      <div className="grid sm:grid-cols-3 gap-3 mb-6">
        <Link to="/professor" className="card-tactile hoverable p-4 flex items-center gap-3" data-testid="manager-link-quizzes"><BookOpen className="text-tutor" /><span className="font-bold text-sm">Conteúdos: quizzes e relatórios</span></Link>
        <Link to="/mural" className="card-tactile hoverable p-4 flex items-center gap-3" data-testid="manager-link-mural"><Images className="text-xp" /><span className="font-bold text-sm">Conteúdos: Mural Milton I.A</span></Link>
        <Link to="/biblioteca" className="card-tactile hoverable p-4 flex items-center gap-3" data-testid="manager-link-library"><LibraryBig className="text-sky" /><span className="font-bold text-sm">Conteúdos: Central de Estudos</span></Link>
      </div>
      <Tabs defaultValue="dashboard">
        <TabsList className="mb-5 flex-wrap h-auto">
          <TabsTrigger value="dashboard" data-testid="manager-tab-dashboard"><Activity /> Dashboard</TabsTrigger>
          <TabsTrigger value="usuarios" data-testid="manager-tab-users"><Users /> Usuários</TabsTrigger>
          <TabsTrigger value="turmas" data-testid="manager-tab-classes"><GraduationCap /> Turmas</TabsTrigger>
          <TabsTrigger value="escola" data-testid="manager-tab-school"><SchoolIcon /> Escola</TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard"><DashboardTab /></TabsContent>
        <TabsContent value="usuarios"><UsersTab /></TabsContent>
        <TabsContent value="turmas"><ClassesTab /></TabsContent>
        <TabsContent value="escola"><SchoolTab /></TabsContent>
      </Tabs>
    </div>
  );
}

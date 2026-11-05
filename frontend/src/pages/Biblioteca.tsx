import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, FileText, Link2, Plus, Presentation, Search, Trash2, BookMarked, Landmark } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import FileDrop from "@/components/FileDrop";
import { EmptyState, PageHeader, Skeleton } from "@/components/common";
import { apiDelete, apiGet, apiPost, errorMessage } from "@/lib/api";
import { useMe } from "@/lib/hooks";
import { EM_SUBJECTS, EF_SUBJECTS, GRADE_SHORT, type Material, type MaterialIn, type MaterialType, type XpOut, type ViewIn } from "@/lib/types";
import { cn } from "@/lib/utils";

const TYPES: Record<MaterialType, { label: string; icon: React.ReactNode; tone: string }> = {
  pdf: { label: "PDF", icon: <FileText />, tone: "bg-ruby/15 text-ruby" },
  apostila: { label: "Apostila", icon: <BookMarked />, tone: "bg-brand/15 text-brand-deep dark:text-brand" },
  slides: { label: "Slides", icon: <Presentation />, tone: "bg-xp/15 text-amber-700 dark:text-xp" },
  link: { label: "Link", icon: <Link2 />, tone: "bg-sky/15 text-sky" },
  seduc: { label: "SEDUC-SP", icon: <Landmark />, tone: "bg-tutor/15 text-tutor" },
};
const ALL_SUBJECTS = Array.from(new Set([...EF_SUBJECTS, ...EM_SUBJECTS]));
const EMPTY: MaterialIn = { title: "", description: "", type: "pdf", url: "", grade: null, subject: null };

function NewMaterial({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState<MaterialIn>(EMPTY);
  const save = useMutation({
    mutationFn: (b: MaterialIn) => apiPost<Material>("/materials", b),
    onSuccess: () => { toast.success("Material publicado!"); void qc.invalidateQueries({ queryKey: ["materials"] }); setF(EMPTY); onOpenChange(false); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-testid="material-dialog">
        <DialogHeader><DialogTitle>Publicar material</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label>Título</Label><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} data-testid="material-title-input" /></div>
          <div className="space-y-1"><Label>Descrição</Label><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} data-testid="material-description-input" /></div>
          <div className="grid grid-cols-3 gap-2">
            <Select value={f.type} onValueChange={(v) => setF({ ...f, type: v as MaterialType })}>
              <SelectTrigger data-testid="material-type-select"><SelectValue>{(v) => TYPES[v as MaterialType]?.label}</SelectValue></SelectTrigger>
              <SelectContent>{Object.entries(TYPES).map(([k, t]) => <SelectItem key={k} value={k}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={f.grade ?? "all"} onValueChange={(v) => setF({ ...f, grade: v === "all" ? null : v })}>
              <SelectTrigger data-testid="material-grade-select"><SelectValue>{(v) => (v === "all" ? "Todas as séries" : GRADE_SHORT[v as string])}</SelectValue></SelectTrigger>
              <SelectContent><SelectItem value="all">Todas as séries</SelectItem>{Object.entries(GRADE_SHORT).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={f.subject ?? "all"} onValueChange={(v) => setF({ ...f, subject: v === "all" ? null : v })}>
              <SelectTrigger data-testid="material-subject-select"><SelectValue>{(v) => (v === "all" ? "Geral" : (v as string))}</SelectValue></SelectTrigger>
              <SelectContent><SelectItem value="all">Geral</SelectItem>{ALL_SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <FileDrop accept=".pdf,.ppt,.pptx,.doc,.docx" hint="PDF, apostilas (DOC) ou slides (PPT) — até 60 MB" testid="material-file-drop"
            onUploaded={(u) => setF((p) => ({ ...p, url: u.url, title: p.title || u.filename.replace(/\.[^.]+$/, "") }))} />
          <div className="space-y-1"><Label>…ou cole um link</Label><Input value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} placeholder="https://" data-testid="material-url-input" /></div>
        </div>
        <DialogFooter>
          <Button disabled={save.isPending || f.title.length < 2 || !f.url} onClick={() => save.mutate(f)} data-testid="material-save-button">Publicar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Biblioteca() {
  const me = useMe();
  const qc = useQueryClient();
  const staff = me.data?.role !== "student";
  const [q, setQ] = useState("");
  const [type, setType] = useState<string>("");
  const [open, setOpen] = useState(false);
  const list = useQuery({
    queryKey: ["materials", q, type],
    queryFn: () => apiGet<Material[]>(`/materials?q=${encodeURIComponent(q)}&type=${type}`),
  });
  const view = useMutation({
    mutationFn: (b: ViewIn) => apiPost<XpOut>("/content/viewed", b),
    onSuccess: (r) => { if (r.xp_awarded) { toast.success(`+${r.xp_awarded} XP por estudar este conteúdo!`); void qc.invalidateQueries({ queryKey: ["me"] }); } },
  });
  const del = useMutation({
    mutationFn: (id: string) => apiDelete(`/materials/${id}`),
    onSuccess: () => { toast.success("Material removido"); void qc.invalidateQueries({ queryKey: ["materials"] }); },
  });

  return (
    <div>
      <PageHeader emoji="📚" title="Central de Estudos" subtitle="Biblioteca digital com PDFs, apostilas, slides, links e materiais da SEDUC-SP."
        actions={staff && <Button className="btn-3d" onClick={() => setOpen(true)} data-testid="material-new-button"><Plus /> Publicar material</Button>} />
      <div className="card-tactile p-3 flex flex-wrap items-center gap-2 mb-5">
        <div className="relative flex-1 min-w-56">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por título, assunto ou disciplina…" className="pl-9 h-10" data-testid="library-search-input" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => setType("")} data-testid="library-filter-all" className={cn("rounded-full border px-3 py-1.5 text-xs font-bold", !type ? "bg-foreground text-background" : "hover:bg-muted")}>Todos</button>
          {Object.entries(TYPES).map(([k, t]) => (
            <button key={k} type="button" onClick={() => setType(k)} data-testid={`library-filter-${k}`} className={cn("rounded-full border px-3 py-1.5 text-xs font-bold", type === k ? "bg-foreground text-background" : "hover:bg-muted")}>{t.label}</button>
          ))}
        </div>
      </div>
      {list.isLoading ? <Skeleton className="h-60" /> : (list.data ?? []).length === 0 ? <EmptyState title="Nenhum material encontrado" hint="Tente outra busca." testid="library-empty" /> : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3" data-testid="library-list">
          {list.data!.map((m) => (
            <div key={m.id} className="card-tactile hoverable p-4 flex flex-col" data-testid={`material-${m.id}`}>
              <div className="flex items-start gap-3">
                <span className={cn("size-11 rounded-xl grid place-items-center shrink-0", TYPES[m.type].tone)}>{TYPES[m.type].icon}</span>
                <div className="min-w-0">
                  <p className="font-bold leading-snug">{m.title}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    <Badge variant="secondary">{TYPES[m.type].label}</Badge>
                    {m.subject && <Badge variant="outline">{m.subject}</Badge>}
                    {m.grade && <Badge variant="outline">{GRADE_SHORT[m.grade]}</Badge>}
                  </div>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-3 flex-1">{m.description}</p>
              <div className="flex items-center justify-between mt-4">
                <a href={m.url} target="_blank" rel="noreferrer" onClick={() => view.mutate({ kind: "material", item_id: m.id })} data-testid={`material-open-${m.id}`}
                  className="inline-flex items-center gap-1 text-sm font-bold text-brand hover:underline">Abrir <ExternalLink className="size-4" /></a>
                {staff && <Button variant="ghost" size="icon-sm" aria-label="Remover material" onClick={() => del.mutate(m.id)} data-testid={`material-delete-${m.id}`}><Trash2 /></Button>}
              </div>
            </div>
          ))}
        </div>
      )}
      {staff && <NewMaterial open={open} onOpenChange={setOpen} />}
    </div>
  );
}

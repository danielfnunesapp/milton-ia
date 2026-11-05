import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Heart, Plus, Send, Trash2, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import FileDrop from "@/components/FileDrop";
import { EmptyState, PageHeader, Skeleton } from "@/components/common";
import { apiDelete, apiGet, apiPost, errorMessage } from "@/lib/api";
import { useMe } from "@/lib/hooks";
import { speak } from "@/lib/prefs";
import { MURAL_CATEGORIES, type MuralCategory, type MuralIn, type MuralPost, type ViewIn, type XpOut } from "@/lib/types";
import { cn } from "@/lib/utils";

const EMPTY: MuralIn = { title: "", description: "", category: "Ciências", media_type: "image", media_url: "", alt_text: "", publish_at: null };

function Publish({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState<MuralIn>(EMPTY);
  const [schedule, setSchedule] = useState(false);
  const [when, setWhen] = useState("");
  const save = useMutation({
    mutationFn: (b: MuralIn) => apiPost<MuralPost>("/mural", b),
    onSuccess: (p) => {
      toast.success(p.scheduled ? "Publicação agendada!" : "Publicado no Mural!");
      void qc.invalidateQueries({ queryKey: ["mural"] });
      setF(EMPTY); setSchedule(false); setWhen(""); onOpenChange(false);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const submit = () => save.mutate({ ...f, publish_at: schedule && when ? new Date(when).toISOString() : null });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90dvh] overflow-y-auto" data-testid="mural-dialog">
        <DialogHeader><DialogTitle>Nova publicação no Mural</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <FileDrop accept=".jpg,.jpeg,.png,.webp,.gif,.mp4,.webm,.mov" maxVideoSec={180} hint="Tirinhas, imagens e infográficos (JPG, PNG, WEBP) ou vídeos curtos de até 3 minutos" testid="mural-file-drop"
            onUploaded={(u) => setF((p) => ({ ...p, media_url: u.url, media_type: u.content_type.startsWith("video") || /\.(mp4|webm|mov)$/i.test(u.url) ? "video" : "image" }))} />
          {f.media_url && (f.media_type === "video"
            ? <video src={f.media_url} className="w-full max-h-48 rounded-xl bg-black" controls data-testid="mural-preview-video" />
            : <img src={f.media_url} alt="Pré-visualização" className="w-full max-h-48 object-contain rounded-xl bg-muted" data-testid="mural-preview-image" />)}
          <div className="space-y-1"><Label>…ou URL da mídia</Label><Input value={f.media_url} onChange={(e) => setF({ ...f, media_url: e.target.value })} placeholder="https://" data-testid="mural-url-input" /></div>
          <div className="space-y-1"><Label>Título</Label><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} data-testid="mural-title-input" /></div>
          <div className="space-y-1"><Label>Descrição</Label><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} data-testid="mural-description-input" /></div>
          <div className="space-y-1"><Label>Audiodescrição (texto alternativo)</Label><Input value={f.alt_text} onChange={(e) => setF({ ...f, alt_text: e.target.value })} placeholder="Descreva a imagem para leitores de tela" data-testid="mural-alt-input" /></div>
          <div>
            <Label>Categoria</Label>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {MURAL_CATEGORIES.map((c) => <button key={c} type="button" onClick={() => setF({ ...f, category: c as MuralCategory })} data-testid={`mural-cat-option-${c}`} className={cn("rounded-full border px-3 py-1 text-xs font-bold", f.category === c ? "bg-brand text-white border-brand" : "hover:bg-muted")}>{c}</button>)}
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant={schedule ? "outline" : "secondary"} size="sm" onClick={() => setSchedule(false)} data-testid="mural-publish-now-toggle"><Send /> Publicar agora</Button>
            <Button type="button" variant={schedule ? "secondary" : "outline"} size="sm" onClick={() => setSchedule(true)} data-testid="mural-schedule-toggle"><CalendarClock /> Agendar</Button>
          </div>
          {schedule && <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} data-testid="mural-schedule-input" />}
        </div>
        <DialogFooter>
          <Button disabled={save.isPending || f.title.length < 2 || !f.media_url || (schedule && !when)} onClick={submit} data-testid="mural-save-button">
            {schedule ? "Agendar publicação" : "Publicar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PostCard({ p, staff, onOpen }: { p: MuralPost; staff: boolean; onOpen: (p: MuralPost) => void }) {
  const qc = useQueryClient();
  const like = useMutation({ mutationFn: () => apiPost<MuralPost>(`/mural/${p.id}/like`), onSuccess: () => void qc.invalidateQueries({ queryKey: ["mural"] }) });
  const del = useMutation({ mutationFn: () => apiDelete(`/mural/${p.id}`), onSuccess: () => { toast.success("Publicação removida"); void qc.invalidateQueries({ queryKey: ["mural"] }); } });
  return (
    <article className="card-tactile overflow-hidden mb-4 break-inside-avoid" data-testid={`mural-post-${p.id}`}>
      <button type="button" className="block w-full bg-muted" onClick={() => onOpen(p)} data-testid={`mural-open-${p.id}`}>
        {p.media_type === "video"
          ? <video src={p.media_url} className="w-full max-h-96 object-cover" muted preload="metadata" aria-label={p.alt_text || p.title} />
          : <img src={p.media_url} alt={p.alt_text || p.title} loading="lazy" className="w-full object-cover hover:scale-[1.02] transition-transform duration-300" />}
      </button>
      <div className="p-4">
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="secondary">{p.category}</Badge>
          {p.media_type === "video" && <Badge variant="outline">🎬 Vídeo</Badge>}
          {p.scheduled && <Badge className="bg-xp/20 text-amber-700" data-testid={`mural-scheduled-${p.id}`}>Agendado · {new Date(p.publish_at).toLocaleString("pt-BR")}</Badge>}
        </div>
        <h3 className="font-heading font-bold text-lg mt-2">{p.title}</h3>
        <p className="text-sm text-muted-foreground mt-1">{p.description}</p>
        <div className="flex items-center gap-1 mt-3">
          <Button variant="ghost" size="sm" onClick={() => like.mutate()} data-testid={`mural-like-${p.id}`} aria-pressed={p.liked}>
            <Heart className={cn(p.liked && "fill-ruby text-ruby")} /> {p.likes}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => speak(`${p.title}. ${p.description}. Audiodescrição: ${p.alt_text || "sem descrição"}`)} data-testid={`mural-audio-${p.id}`}><Volume2 /> Audiodescrição</Button>
          {staff && <Button variant="ghost" size="icon-sm" className="ml-auto" aria-label="Remover" onClick={() => del.mutate()} data-testid={`mural-delete-${p.id}`}><Trash2 /></Button>}
        </div>
      </div>
    </article>
  );
}

export default function Mural() {
  const me = useMe();
  const qc = useQueryClient();
  const staff = me.data?.role !== "student";
  const [cat, setCat] = useState("");
  const [open, setOpen] = useState(false);
  const [viewing, setViewing] = useState<MuralPost | null>(null);
  const list = useQuery({ queryKey: ["mural", cat], queryFn: () => apiGet<MuralPost[]>(`/mural?category=${encodeURIComponent(cat)}`) });
  const view = useMutation({
    mutationFn: (b: ViewIn) => apiPost<XpOut>("/content/viewed", b),
    onSuccess: (r) => { if (r.xp_awarded) { toast.success(`+${r.xp_awarded} XP por assistir este conteúdo!`); void qc.invalidateQueries({ queryKey: ["me"] }); } },
  });
  const openPost = (p: MuralPost) => { setViewing(p); view.mutate({ kind: "mural", item_id: p.id }); };

  return (
    <div>
      <PageHeader emoji="🖼️" title="Mural Milton I.A" subtitle="Tirinhas, imagens educativas, infográficos e vídeos curtos de até 3 minutos."
        actions={staff && <Button className="btn-3d" onClick={() => setOpen(true)} data-testid="mural-new-button"><Plus /> Nova publicação</Button>} />
      <div className="flex flex-wrap gap-1.5 mb-5">
        <button type="button" onClick={() => setCat("")} data-testid="mural-filter-all" className={cn("rounded-full border px-3 py-1.5 text-sm font-bold", !cat ? "bg-foreground text-background" : "bg-card hover:bg-muted")}>Todos</button>
        {MURAL_CATEGORIES.map((c) => <button key={c} type="button" onClick={() => setCat(c)} data-testid={`mural-filter-${c}`} className={cn("rounded-full border px-3 py-1.5 text-sm font-bold", cat === c ? "bg-foreground text-background" : "bg-card hover:bg-muted")}>{c}</button>)}
      </div>
      {list.isLoading ? <Skeleton className="h-80" /> : (list.data ?? []).length === 0 ? <EmptyState title="Nada publicado nesta categoria ainda" testid="mural-empty" /> : (
        <div className="columns-1 sm:columns-2 xl:columns-3 gap-4" data-testid="mural-feed">
          {list.data!.map((p) => <PostCard key={p.id} p={p} staff={staff} onOpen={openPost} />)}
        </div>
      )}
      <Dialog open={!!viewing} onOpenChange={(v) => !v && setViewing(null)}>
        <DialogContent className="sm:max-w-3xl" data-testid="mural-viewer">
          {viewing && (
            <>
              <DialogHeader><DialogTitle>{viewing.title}</DialogTitle></DialogHeader>
              {viewing.media_type === "video"
                ? <video src={viewing.media_url} controls autoPlay className="w-full max-h-[70dvh] rounded-xl bg-black" />
                : <img src={viewing.media_url} alt={viewing.alt_text || viewing.title} className="w-full max-h-[70dvh] object-contain rounded-xl" />}
              <p className="text-sm text-muted-foreground">{viewing.description}</p>
            </>
          )}
        </DialogContent>
      </Dialog>
      {staff && <Publish open={open} onOpenChange={setOpen} />}
    </div>
  );
}

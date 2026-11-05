import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Clock, Swords, Trophy, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, EmptyState, PageHeader, Skeleton } from "@/components/common";
import { PreparingDialog } from "@/pages/Trilhas";
import { apiGet, apiPost, errorMessage } from "@/lib/api";
import { useMe } from "@/lib/hooks";
import { subjectsFor, type Attempt, type Curriculum, type Duel, type DuelIn, type Opponent } from "@/lib/types";
import { cn } from "@/lib/utils";

function hoursLeft(iso: string) {
  const h = Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 36e5));
  return h <= 1 ? "menos de 1h" : `${h}h`;
}

function DuelCard({ d, onPlay, onAccept, onDecline, busy }: { d: Duel; onPlay: (id: string) => void; onAccept: (id: string) => void; onDecline: (id: string) => void; busy: boolean }) {
  const rival = d.my_side === "challenger" ? d.opponent_name : d.challenger_name;
  const finished = d.status === "done" || d.status === "expired";
  return (
    <div className={cn("card-tactile p-4", finished && d.i_won && "ring-2 ring-xp")} data-testid={`duel-card-${d.id}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-heading font-bold">⚔️ {d.my_side === "challenger" ? `Você desafiou ${rival}` : `${rival} desafiou você`}</p>
          <p className="text-xs text-muted-foreground truncate">{d.subject} · {d.topic_label} · {d.total} questões</p>
        </div>
        {finished ? (
          <Badge className={d.i_won ? "bg-xp/25 text-amber-700" : "bg-muted text-muted-foreground"} data-testid={`duel-result-${d.id}`}>
            {d.i_won ? `🏆 Vitória +${d.bonus_xp} XP` : d.winner_name ? `Vencedor: ${d.winner_name}` : "Empate"}
          </Badge>
        ) : d.status === "declined" ? <Badge variant="outline">Recusado</Badge> : (
          <Badge variant="outline" className="gap-1"><Clock className="size-3" /> {hoursLeft(d.expires_at)}</Badge>
        )}
      </div>
      {(d.my_score !== null || d.their_score !== null) && (
        <div className="mt-3 flex items-center gap-3 text-sm font-semibold" data-testid={`duel-score-${d.id}`}>
          <span className="rounded-lg bg-brand/15 px-2.5 py-1">Você: {d.my_score ?? "—"}/{d.total}</span>
          <span className="text-muted-foreground">×</span>
          <span className="rounded-lg bg-muted px-2.5 py-1">{rival.split(" ")[0]}: {d.their_score ?? "aguardando"}{d.their_score !== null && `/${d.total}`}</span>
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {d.can_accept && (
          <>
            <Button size="sm" className="btn-3d" disabled={busy} onClick={() => onAccept(d.id)} data-testid={`duel-accept-${d.id}`}><Check /> Aceitar e jogar</Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => onDecline(d.id)} data-testid={`duel-decline-${d.id}`}><X /> Recusar</Button>
          </>
        )}
        {!d.can_accept && !d.my_done && d.my_attempt_id && (d.status === "pending" || d.status === "active") && (
          <Button size="sm" className="btn-3d" onClick={() => onPlay(d.my_attempt_id!)} data-testid={`duel-play-${d.id}`}><Swords /> Jogar minha parte</Button>
        )}
        {d.my_done && !finished && <p className="text-xs text-muted-foreground">Sua parte foi enviada — aguardando {rival.split(" ")[0]} (até 24h). Se não responder, você vence por W.O.</p>}
      </div>
    </div>
  );
}

export default function Duelos() {
  const me = useMe();
  const nav = useNavigate();
  const qc = useQueryClient();
  const grade = me.data?.grade ?? "6EF";
  const [opp, setOpp] = useState<string>("");
  const [subject, setSubject] = useState("Matemática");
  const [bim, setBim] = useState("1");
  const [preparing, setPreparing] = useState("");
  const opponents = useQuery({ queryKey: ["duel-opponents"], queryFn: () => apiGet<Opponent[]>("/duels/opponents") });
  const duels = useQuery({ queryKey: ["duels"], queryFn: () => apiGet<Duel[]>("/duels") });
  const cur = useQuery({ queryKey: ["curriculum", grade], queryFn: () => apiGet<Curriculum>(`/curriculum/${grade}`), enabled: !!me.data });
  const topic = cur.data?.subjects.find((s) => s.subject === subject)?.topics[Number(bim) - 1];
  const oppName = (id: string) => opponents.data?.find((o) => o.id === id)?.name ?? "";

  const go = (a: Attempt) => { void qc.invalidateQueries({ queryKey: ["duels"] }); nav(`/quiz/${a.id}`); };
  const create = useMutation({ mutationFn: (b: DuelIn) => apiPost<Attempt>("/duels", b), onSuccess: (a) => { toast.success("Desafio enviado! Agora jogue sua parte."); go(a); }, onError: (e) => toast.error(errorMessage(e)), onSettled: () => setPreparing("") });
  const accept = useMutation({ mutationFn: (id: string) => apiPost<Attempt>(`/duels/${id}/accept`), onSuccess: go, onError: (e) => toast.error(errorMessage(e)) });
  const decline = useMutation({ mutationFn: (id: string) => apiPost(`/duels/${id}/decline`), onSuccess: () => { toast("Desafio recusado"); void qc.invalidateQueries({ queryKey: ["duels"] }); } });

  const list = duels.data ?? [];
  const open = list.filter((d) => d.status === "pending" || d.status === "active");
  const closed = list.filter((d) => !open.includes(d));
  const wins = list.filter((d) => d.i_won).length;
  const busy = create.isPending || accept.isPending || decline.isPending;

  return (
    <div>
      <PageHeader emoji="⚔️" title="Duelos entre Colegas" subtitle={`Desafie um colega: os dois respondem as mesmas 5 questões, cada um no seu tempo (até 24h). Quem acertar mais vence e ganha +50 XP — empate é decidido pelo menor tempo.`} />
      <div className="grid lg:grid-cols-[1fr_1.3fr] gap-5">
        <div className="card-tactile p-5 h-fit space-y-3 relative overflow-hidden">
          <div className="absolute -right-6 -top-6 size-28 rounded-full bg-ruby/15 blur-2xl decor" aria-hidden />
          <p className="font-heading font-bold text-lg">Novo desafio</p>
          <Select value={opp} onValueChange={setOpp}>
            <SelectTrigger className="w-full" data-testid="duel-opponent-select"><SelectValue>{(v) => (v ? oppName(v as string) : "Escolha um colega")}</SelectValue></SelectTrigger>
            <SelectContent>
              {(opponents.data ?? []).map((o) => (
                <SelectItem key={o.id} value={o.id} data-testid={`duel-opponent-${o.id}`}>
                  <span className="flex items-center gap-2"><Avatar name={o.name} color={o.avatar_color} size={22} />{o.name}{o.class_name && <span className="text-xs text-muted-foreground">· {o.class_name}</span>}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="grid grid-cols-2 gap-2">
            <Select value={subject} onValueChange={setSubject}>
              <SelectTrigger className="w-full" data-testid="duel-subject-select"><SelectValue /></SelectTrigger>
              <SelectContent>{subjectsFor(grade).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={bim} onValueChange={setBim}>
              <SelectTrigger className="w-full" data-testid="duel-bimestre-select"><SelectValue>{(v) => `${v as string}º bimestre`}</SelectValue></SelectTrigger>
              <SelectContent>{["1", "2", "3", "4"].map((b) => <SelectItem key={b} value={b}>{b}º bimestre</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {topic && <p className="text-xs rounded-lg bg-muted p-2.5" data-testid="duel-topic-info"><b className="font-mono">{topic.habilidade}</b> · {topic.objeto}</p>}
          <Button className="w-full btn-3d bg-ruby hover:bg-ruby/90 text-white" disabled={!opp || !topic || busy} data-testid="duel-create-button"
            onClick={() => { setPreparing(`Duelo contra ${oppName(opp)}`); create.mutate({ opponent_id: opp, topic_id: topic!.id }); }}>
            <Swords /> Desafiar e jogar agora
          </Button>
          <p className="text-xs text-muted-foreground flex items-center gap-1"><Trophy className="size-3.5 text-xp" /> Você já venceu <b data-testid="duel-wins-count">{wins}</b> duelo(s).</p>
        </div>
        <div className="space-y-5">
          <section>
            <h2 className="font-heading font-bold text-lg mb-2">Em andamento</h2>
            {duels.isLoading ? <Skeleton className="h-28" /> : open.length === 0 ? <EmptyState title="Nenhum duelo em andamento" hint="Desafie um colega ao lado!" testid="duels-open-empty" /> : (
              <div className="space-y-3" data-testid="duels-open-list">{open.map((d) => <DuelCard key={d.id} d={d} busy={busy} onPlay={(id) => nav(`/quiz/${id}`)} onAccept={(id) => accept.mutate(id)} onDecline={(id) => decline.mutate(id)} />)}</div>
            )}
          </section>
          {closed.length > 0 && (
            <section>
              <h2 className="font-heading font-bold text-lg mb-2">Encerrados</h2>
              <div className="space-y-3" data-testid="duels-closed-list">{closed.map((d) => <DuelCard key={d.id} d={d} busy={busy} onPlay={() => undefined} onAccept={() => undefined} onDecline={() => undefined} />)}</div>
            </section>
          )}
        </div>
      </div>
      <PreparingDialog open={!!preparing} label={preparing} />
    </div>
  );
}

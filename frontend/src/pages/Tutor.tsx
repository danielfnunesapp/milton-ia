import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Loader2, MessageSquarePlus, Send, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Markdown, PageHeader } from "@/components/common";
import { apiGet, apiStream, errorMessage } from "@/lib/api";
import { useMe } from "@/lib/hooks";
import { speak } from "@/lib/prefs";
import { GRADE_SHORT, type TutorChatIn, type TutorMessage, type TutorMode, type TutorSession } from "@/lib/types";
import { cn } from "@/lib/utils";

const MODES: { mode: TutorMode; label: string; emoji: string; placeholder: string }[] = [
  { mode: "duvida", label: "Tirar dúvida", emoji: "❓", placeholder: "Qual é a sua dúvida?" },
  { mode: "explicar", label: "Explicar conteúdo", emoji: "🧑‍🏫", placeholder: "Ex.: Explique o Teorema de Pitágoras" },
  { mode: "questoes", label: "Criar questões", emoji: "📝", placeholder: "Ex.: Questões sobre Revolução Francesa" },
  { mode: "resumir", label: "Resumir texto", emoji: "✂️", placeholder: "Cole aqui o texto que deseja resumir" },
  { mode: "mapa_mental", label: "Mapa mental", emoji: "🧠", placeholder: "Ex.: Mapa mental de ecossistemas" },
  { mode: "plano", label: "Sugestões de estudo", emoji: "📅", placeholder: "Ex.: Plano para melhorar em Matemática" },
];
interface Msg { role: "user" | "assistant"; content: string }

export default function Tutor() {
  const me = useMe();
  const qc = useQueryClient();
  const [mode, setMode] = useState<TutorMode>("duvida");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const sessions = useQuery({ queryKey: ["tutor-sessions"], queryFn: () => apiGet<TutorSession[]>("/tutor/sessions") });

  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs]);

  async function openSession(id: string) {
    try {
      const m = await qc.fetchQuery({ queryKey: ["tutor-session", id], queryFn: () => apiGet<TutorMessage[]>(`/tutor/sessions/${id}`) });
      setSessionId(id);
      setMsgs(m.map((x) => ({ role: x.role, content: x.content })));
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  async function send(text = input) {
    const message = text.trim();
    if (!message || streaming) return;
    setInput("");
    setMsgs((m) => [...m, { role: "user", content: message }, { role: "assistant", content: "" }]);
    setStreaming(true);
    const body: TutorChatIn = { session_id: sessionId, message, mode };
    try {
      await apiStream("/tutor/chat", body, (event, data) => {
        if (event === "session") setSessionId(String(data.session_id));
        if (event === "delta") setMsgs((m) => { const c = [...m]; c[c.length - 1] = { role: "assistant", content: c[c.length - 1].content + String(data.text ?? "") }; return c; });
        if (event === "error") toast.error(String(data.message));
      });
    } catch (e) {
      toast.error(errorMessage(e, "O Tutor não respondeu. Tente novamente."));
    } finally {
      setStreaming(false);
      void qc.invalidateQueries({ queryKey: ["tutor-sessions"] });
    }
  }

  const current = MODES.find((m) => m.mode === mode)!;
  const first = me.data?.name.split(" ")[0] ?? "";

  return (
    <div>
      <PageHeader emoji="🤖" title="Milton I.A Tutor" subtitle={`Explicações na linguagem do ${GRADE_SHORT[me.data?.grade ?? ""] ?? "seu nível"} — alinhadas ao Currículo Paulista e à BNCC.`} />
      <div className="grid lg:grid-cols-[240px_1fr] gap-5">
        <aside className="hidden lg:block card-tactile p-3 h-fit">
          <Button variant="secondary" className="w-full" onClick={() => { setSessionId(null); setMsgs([]); }} data-testid="tutor-new-chat-button"><MessageSquarePlus /> Nova conversa</Button>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mt-4 mb-2 px-1">Conversas</p>
          <div className="space-y-1 max-h-[55dvh] overflow-y-auto">
            {(sessions.data ?? []).map((s) => (
              <button key={s.session_id} type="button" onClick={() => void openSession(s.session_id)} data-testid={`tutor-session-${s.session_id}`}
                className={cn("w-full text-left text-sm rounded-lg px-2 py-1.5 truncate", s.session_id === sessionId ? "bg-tutor/15 text-tutor font-semibold" : "hover:bg-muted")}>{s.title}</button>
            ))}
            {sessions.data?.length === 0 && <p className="text-xs text-muted-foreground px-1">Nenhuma conversa ainda.</p>}
          </div>
        </aside>

        <section className="card-tactile flex flex-col min-h-[65dvh]">
          <div className="flex gap-1.5 overflow-x-auto p-3 border-b" role="tablist">
            {MODES.map((m) => (
              <button key={m.mode} type="button" role="tab" aria-selected={mode === m.mode} onClick={() => setMode(m.mode)} data-testid={`tutor-mode-${m.mode}`}
                className={cn("shrink-0 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors duration-150", mode === m.mode ? "bg-tutor text-white border-tutor" : "hover:bg-muted")}>
                <span aria-hidden>{m.emoji}</span> {m.label}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4" data-testid="tutor-messages" aria-live="polite">
            {msgs.length === 0 && (
              <div className="text-center py-10">
                <div className="mx-auto size-16 rounded-2xl bg-tutor/15 grid place-items-center animate-pulse-ring"><Bot className="size-9 text-tutor" /></div>
                <p className="font-heading font-bold text-xl mt-4">Oi{first && `, ${first}`}! Eu sou o Milton I.A.</p>
                <p className="text-sm text-muted-foreground mt-1">Escolha um modo acima e me pergunte qualquer coisa da escola.</p>
                <div className="flex flex-wrap justify-center gap-2 mt-5">
                  {["Explique equações do 2º grau com um exemplo", "Faça um mapa mental sobre a Era Vargas", "Como estudar para o ENEM em 3 meses?"].map((s, i) => (
                    <button key={s} type="button" onClick={() => void send(s)} data-testid={`tutor-suggestion-${i}`} className="rounded-xl border bg-card px-3 py-2 text-sm hover:bg-muted">{s}</button>
                  ))}
                </div>
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={cn("flex gap-3", m.role === "user" && "justify-end")} data-testid={`tutor-message-${m.role}`}>
                {m.role === "assistant" && <span className="size-8 shrink-0 rounded-xl bg-tutor text-white grid place-items-center"><Bot className="size-4" /></span>}
                <div className={cn("rounded-2xl px-4 py-3 max-w-[85%] text-sm md:text-base", m.role === "user" ? "bg-brand text-white rounded-br-md" : "bg-muted rounded-bl-md")}>
                  {m.role === "assistant" ? (m.content ? <Markdown text={m.content} /> : <Loader2 className="animate-spin size-4" />) : <p className="whitespace-pre-wrap">{m.content}</p>}
                  {m.role === "assistant" && m.content && !(streaming && i === msgs.length - 1) && (
                    <button type="button" className="mt-2 text-xs font-semibold text-tutor inline-flex items-center gap-1 hover:underline" onClick={() => speak(m.content)} data-testid={`tutor-speak-${i}`}><Volume2 className="size-3.5" /> Ouvir resposta</button>
                  )}
                </div>
              </div>
            ))}
            <div ref={end} />
          </div>
          <form className="p-3 border-t flex gap-2 items-end" onSubmit={(e) => { e.preventDefault(); void send(); }}>
            <Textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder={current.placeholder} rows={mode === "resumir" ? 4 : 1} className="min-h-11 resize-none" data-testid="tutor-input"
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }} />
            <Button type="submit" size="lg" className="btn-3d bg-tutor hover:bg-tutor/90 text-white h-11" disabled={streaming || !input.trim()} data-testid="tutor-send-button" aria-label="Enviar">
              {streaming ? <Loader2 className="animate-spin" /> : <Send />}
            </Button>
          </form>
        </section>
      </div>
    </div>
  );
}

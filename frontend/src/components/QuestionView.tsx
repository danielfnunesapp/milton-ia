import { useState } from "react";
import { Volume2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { playSound, speak, usePrefs } from "@/lib/prefs";
import type { AnswerValue, QuestionPublic } from "@/lib/types";
import { cn } from "@/lib/utils";

const LETTERS = "ABCDE";
const TYPE_LABEL: Record<string, string> = {
  multiple_choice: "Múltipla escolha", true_false: "Verdadeiro ou Falso", complete: "Complete a frase", association: "Associe os conceitos (arraste e solte)",
};

function OptionList({ q, value, onPick }: { q: QuestionPublic; value: string | undefined; onPick: (v: string) => void }) {
  const tf = q.type === "true_false";
  return (
    <div className={cn("grid gap-3", tf ? "grid-cols-2" : "grid-cols-1")} role="radiogroup">
      {q.options.map((opt, i) => {
        const sel = value === opt;
        return (
          <button key={opt} type="button" role="radio" aria-checked={sel} data-testid={`quiz-option-${i}`} onClick={() => onPick(opt)}
            className={cn("btn-3d text-left rounded-2xl border-2 px-4 py-3.5 flex items-center gap-3 font-medium",
              sel ? "border-brand bg-brand/10 text-foreground" : "border-border bg-card hover:bg-muted/60",
              tf && "justify-center text-lg font-heading font-bold py-6")}>
            {!tf && (
              <span className={cn("size-8 shrink-0 rounded-lg grid place-items-center text-sm font-bold border-2", sel ? "bg-brand border-brand text-white" : "border-border text-muted-foreground")}>
                {LETTERS[i]}
              </span>
            )}
            {tf && <span aria-hidden className="text-2xl">{opt === "Verdadeiro" ? "✅" : "❌"}</span>}
            <span>{opt.replace(/^[A-E]\)\s*/, "")}</span>
          </button>
        );
      })}
    </div>
  );
}

function Association({ q, value, onChange }: { q: QuestionPublic; value: Record<string, string>; onChange: (v: Record<string, string>) => void }) {
  const [picked, setPicked] = useState<string | null>(null);
  const used = new Set(Object.values(value));
  const place = (left: string, right: string) => {
    const next = Object.fromEntries(Object.entries(value).filter(([, r]) => r !== right));
    next[left] = right;
    onChange(next);
    setPicked(null);
  };
  return (
    <div className="grid md:grid-cols-[1fr_1fr] gap-5">
      <div className="space-y-3">
        {q.left.map((l, i) => (
          <div key={l} className="rounded-2xl border-2 border-border bg-card p-3">
            <p className="font-semibold text-sm">{l}</p>
            <div data-testid={`assoc-slot-${i}`} role="button" tabIndex={0}
              onClick={() => (picked ? place(l, picked) : value[l] && onChange(Object.fromEntries(Object.entries(value).filter(([k]) => k !== l))))}
              onKeyDown={(e) => e.key === "Enter" && picked && place(l, picked)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); place(l, e.dataTransfer.getData("text/plain")); }}
              className={cn("mt-2 min-h-11 rounded-xl border-2 border-dashed px-3 py-2 text-sm flex items-center justify-between gap-2 transition-colors duration-150",
                value[l] ? "border-tutor bg-tutor/10" : picked ? "border-brand bg-brand/5" : "border-input text-muted-foreground")}>
              {value[l] ?? "Solte aqui"}
              {value[l] && <X className="size-4 shrink-0" aria-label="Remover" />}
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap content-start gap-2" aria-label="Itens para associar">
        {q.right.map((r, i) => (
          <button key={r} type="button" draggable={!used.has(r)} data-testid={`assoc-chip-${i}`} disabled={used.has(r)}
            onDragStart={(e) => e.dataTransfer.setData("text/plain", r)} onClick={() => setPicked(picked === r ? null : r)}
            className={cn("btn-3d rounded-xl border-2 px-3 py-2 text-sm font-medium text-left cursor-grab active:cursor-grabbing",
              used.has(r) ? "opacity-35 border-border" : picked === r ? "border-brand bg-brand/15" : "border-border bg-card hover:bg-muted")}>
            {r}
          </button>
        ))}
        <p className="w-full text-xs text-muted-foreground mt-1">Arraste um item até o conceito — ou toque no item e depois no espaço.</p>
      </div>
    </div>
  );
}

export default function QuestionView({ q, index, value, onChange }: { q: QuestionPublic; index: number; value: AnswerValue | undefined; onChange: (v: AnswerValue) => void }) {
  const { sound } = usePrefs();
  const pick = (v: string) => { playSound("tap", sound); onChange(v); };
  const blank = /_{3,}/;
  const strVal = typeof value === "string" ? value : undefined;
  const parts = q.type === "complete" ? q.statement.split(blank) : null;
  const readAloud = () => speak(`${q.statement}. ${q.options.map((o, i) => `${LETTERS[i]}: ${o}`).join(". ")} ${q.left.length ? `Conceitos: ${q.left.join(", ")}. Itens: ${q.right.join(", ")}` : ""}`);

  return (
    <div className="animate-pop" key={q.id}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="text-xs font-bold uppercase tracking-wider text-tutor" data-testid="question-type-label">{TYPE_LABEL[q.type]}</span>
        <Button variant="ghost" size="sm" onClick={readAloud} data-testid="question-read-aloud-button"><Volume2 /> Ouvir</Button>
      </div>
      <h2 className="text-xl md:text-2xl font-heading font-semibold leading-snug mb-6 whitespace-pre-line" data-testid="question-statement">
        <span className="text-muted-foreground mr-2">{index + 1}.</span>
        {parts && parts.length > 1 ? (
          <>
            {parts[0]}
            <span className={cn("inline-block min-w-24 mx-1 px-2 border-b-4 text-center", strVal ? "border-brand text-brand" : "border-muted-foreground/40")}>{strVal ?? "\u00a0"}</span>
            {parts.slice(1).join("_____")}
          </>
        ) : q.statement}
      </h2>
      {q.image_url && (
        <a href={q.image_url} target="_blank" rel="noreferrer" className="block mb-6" data-testid="question-image-link">
          <img src={q.image_url} alt={`Imagem de apoio da questão ${index + 1}: mapa, gráfico ou diagrama`} data-testid="question-image"
            className="mx-auto max-h-80 w-auto rounded-2xl border bg-white object-contain p-2 hover:scale-[1.01] transition-transform duration-200" />
        </a>
      )}
      {q.type === "association" ? (
        <Association q={q} value={(value as Record<string, string>) ?? {}} onChange={onChange} />
      ) : q.type === "complete" ? (
        <div className="flex flex-wrap gap-3" role="radiogroup">
          {q.options.map((o, i) => (
            <button key={o} type="button" role="radio" aria-checked={strVal === o} data-testid={`quiz-option-${i}`} onClick={() => pick(o)}
              className={cn("btn-3d rounded-xl border-2 px-4 py-2.5 font-semibold", strVal === o ? "border-brand bg-brand/10" : "border-border bg-card hover:bg-muted")}>
              {o}
            </button>
          ))}
        </div>
      ) : (
        <OptionList q={q} value={strVal} onPick={pick} />
      )}
    </div>
  );
}

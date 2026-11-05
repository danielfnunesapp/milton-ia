import { useRef, useState } from "react";
import { UploadCloud, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiUpload, errorMessage } from "@/lib/api";
import type { UploadOut } from "@/lib/types";
import { cn } from "@/lib/utils";

function videoDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => { URL.revokeObjectURL(v.src); resolve(v.duration); };
    v.onerror = () => resolve(0);
    v.src = URL.createObjectURL(file);
  });
}

export default function FileDrop({ accept, hint, onUploaded, maxVideoSec, testid = "file-drop-zone" }: {
  accept: string; hint: string; onUploaded: (u: UploadOut) => void; maxVideoSec?: number; testid?: string;
}) {
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function handle(file: File | undefined) {
    if (!file) return;
    if (maxVideoSec && file.type.startsWith("video/")) {
      const d = await videoDuration(file);
      if (d > maxVideoSec) {
        toast.error(`O vídeo tem ${Math.round(d)}s — o limite é de ${maxVideoSec / 60} minutos.`);
        return;
      }
    }
    setBusy(true);
    try {
      const out = await apiUpload<UploadOut>("/uploads", file);
      setName(out.filename);
      onUploaded(out);
      toast.success("Arquivo enviado!");
    } catch (e) {
      toast.error(errorMessage(e, "Falha no envio do arquivo"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="button" tabIndex={0} data-testid={testid}
      onClick={() => input.current?.click()}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); void handle(e.dataTransfer.files[0]); }}
      className={cn("rounded-2xl border-2 border-dashed p-6 text-center cursor-pointer transition-colors duration-150",
        over ? "border-brand bg-brand/10" : "border-input hover:border-brand/60 hover:bg-muted/50")}
    >
      <input ref={input} type="file" accept={accept} className="hidden" data-testid={`${testid}-input`} onChange={(e) => void handle(e.target.files?.[0])} />
      {busy ? <Loader2 className="mx-auto size-8 animate-spin text-brand" /> : <UploadCloud className="mx-auto size-8 text-brand" />}
      <p className="mt-2 text-sm font-semibold">{name ?? "Arraste o arquivo aqui ou clique para selecionar"}</p>
      <p className="text-xs text-muted-foreground mt-1">{hint}</p>
    </div>
  );
}

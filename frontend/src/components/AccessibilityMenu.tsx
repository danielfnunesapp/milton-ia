import { Accessibility, Contrast, Hand, Minus, Moon, Plus, Sun, Volume2, VolumeX, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { speak, stopSpeaking, usePrefs, type FontScale } from "@/lib/prefs";
import { cn } from "@/lib/utils";

const SCALES: FontScale[] = [100, 115, 130];

function Row({ id, label, icon, checked, onChange }: { id: string; label: string; icon: React.ReactNode; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label htmlFor={id} className="flex items-center justify-between gap-3 py-2 cursor-pointer">
      <span className="flex items-center gap-2 text-sm">{icon}{label}</span>
      <Checkbox id={id} data-testid={id} checked={checked} onCheckedChange={(v) => onChange(Boolean(v))} />
    </label>
  );
}

export function ThemeToggle() {
  const p = usePrefs();
  return (
    <Button variant="ghost" size="icon" aria-label={p.dark ? "Ativar modo claro" : "Ativar modo escuro"} data-testid="theme-toggle-button" onClick={() => p.set("dark", !p.dark)}>
      {p.dark ? <Sun /> : <Moon />}
    </Button>
  );
}

export default function AccessibilityMenu() {
  const p = usePrefs();
  const idx = SCALES.indexOf(p.fontScale);
  return (
    <Popover>
      <PopoverTrigger render={<Button variant="ghost" size="icon" aria-label="Acessibilidade" data-testid="accessibility-menu-button" />}>
        <Accessibility />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80" data-testid="accessibility-panel">
        <p className="font-heading font-bold text-base">Inclusão e Acessibilidade</p>
        <div className="mt-2">
          <div className="flex items-center justify-between py-2">
            <span className="text-sm">Tamanho da fonte</span>
            <div className="flex items-center gap-1">
              <Button size="icon-sm" variant="outline" aria-label="Diminuir fonte" data-testid="font-decrease-button" disabled={idx === 0} onClick={() => p.set("fontScale", SCALES[idx - 1])}><Minus /></Button>
              <span className="w-12 text-center text-sm font-semibold" data-testid="font-scale-value">{p.fontScale}%</span>
              <Button size="icon-sm" variant="outline" aria-label="Aumentar fonte" data-testid="font-increase-button" disabled={idx === SCALES.length - 1} onClick={() => p.set("fontScale", SCALES[idx + 1])}><Plus /></Button>
            </div>
          </div>
          <Row id="toggle-dark-mode" label="Modo escuro" icon={<Moon className="size-4" />} checked={p.dark} onChange={(v) => p.set("dark", v)} />
          <Row id="toggle-high-contrast" label="Alto contraste" icon={<Contrast className="size-4" />} checked={p.contrast} onChange={(v) => p.set("contrast", v)} />
          <Row id="toggle-simple-nav" label="Navegação simplificada" icon={<Wand2 className="size-4" />} checked={p.simple} onChange={(v) => p.set("simple", v)} />
          <Row id="toggle-sound" label="Efeitos sonoros" icon={p.sound ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />} checked={p.sound} onChange={(v) => p.set("sound", v)} />
        </div>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <Button variant="secondary" size="sm" data-testid="read-page-button" onClick={() => speak(document.querySelector("main")?.textContent?.slice(0, 3000) ?? "")}>
            <Volume2 /> Ler página
          </Button>
          <Button variant="outline" size="sm" data-testid="stop-reading-button" onClick={stopSpeaking}>Parar leitura</Button>
        </div>
        <div className={cn("mt-3 flex items-center gap-2 rounded-lg bg-muted p-2 text-xs text-muted-foreground")}>
          <Hand className="size-4 shrink-0" /> Libras (VLibras) — integração futura. Imagens do Mural têm audiodescrição.
        </div>
      </PopoverContent>
    </Popover>
  );
}

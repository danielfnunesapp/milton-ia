import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type FontScale = 100 | 115 | 130;
interface Prefs {
  dark: boolean; contrast: boolean; simple: boolean; sound: boolean; fontScale: FontScale;
}
interface PrefsCtx extends Prefs {
  set: <K extends keyof Prefs>(k: K, v: Prefs[K]) => void;
}

const KEY = "milton-prefs";
const DEFAULTS: Prefs = { dark: false, contrast: false, simple: false, sound: true, fontScale: 100 };
const Ctx = createContext<PrefsCtx | null>(null);

function load(): Prefs {
  try {
    return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) || "{}") as Partial<Prefs>) };
  } catch {
    return DEFAULTS;
  }
}

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(load);
  useEffect(() => {
    const el = document.documentElement;
    el.classList.toggle("dark", prefs.dark);
    el.classList.toggle("hc", prefs.contrast);
    el.classList.toggle("simple", prefs.simple);
    el.style.fontSize = `${prefs.fontScale}%`;
    localStorage.setItem(KEY, JSON.stringify(prefs));
  }, [prefs]);
  const set = useCallback(<K extends keyof Prefs>(k: K, v: Prefs[K]) => setPrefs((p) => ({ ...p, [k]: v })), []);
  return <Ctx.Provider value={{ ...prefs, set }}>{children}</Ctx.Provider>;
}

export function usePrefs(): PrefsCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("PrefsProvider missing");
  return c;
}

// ---- Leitura por voz (Web Speech API, pt-BR) ----
export function speak(text: string): void {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/[#*_`>-]/g, " "));
  u.lang = "pt-BR";
  const voice = window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith("pt"));
  if (voice) u.voice = voice;
  u.rate = 1;
  window.speechSynthesis.speak(u);
}
export function stopSpeaking(): void {
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}

// ---- Efeitos sonoros sintetizados (Web Audio) ----
let ctx: AudioContext | null = null;
export function playSound(kind: "correct" | "wrong" | "levelup" | "tap", enabled: boolean): void {
  if (!enabled) return;
  try {
    ctx = ctx ?? new AudioContext();
    const notes = { correct: [660, 880], wrong: [220, 170], levelup: [523, 659, 784, 1046], tap: [520] }[kind];
    notes.forEach((f, i) => {
      const o = ctx!.createOscillator();
      const g = ctx!.createGain();
      o.type = kind === "wrong" ? "sawtooth" : "triangle";
      o.frequency.value = f;
      const t = ctx!.currentTime + i * 0.1;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      o.connect(g).connect(ctx!.destination);
      o.start(t);
      o.stop(t + 0.2);
    });
  } catch {
    /* audio unsupported */
  }
}

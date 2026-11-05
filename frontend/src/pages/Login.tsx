import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { BookOpen, GraduationCap, HeartHandshake, Loader2, ShieldCheck, Trophy, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import AccessibilityMenu, { ThemeToggle } from "@/components/AccessibilityMenu";
import { MiltonMark, SchoolLogo } from "@/components/common";
import { apiPost, errorMessage } from "@/lib/api";
import { homeFor, useMe, useSchool } from "@/lib/hooks";
import { beginSession } from "@/lib/session";
import type { LoginIn, User } from "@/lib/types";

const DEMOS = [
  { label: "Estudante · 9º ano", email: "aluno@milton.edu.br", icon: <GraduationCap className="size-4" />, id: "student" },
  { label: "Estudante · 3ª série EM", email: "aluna.em@milton.edu.br", icon: <Trophy className="size-4" />, id: "student-em" },
  { label: "Professor(a)", email: "professor@milton.edu.br", icon: <BookOpen className="size-4" />, id: "teacher" },
  { label: "Gestor(a)", email: "gestor@milton.edu.br", icon: <ShieldCheck className="size-4" />, id: "manager" },
  { label: "Responsável (família)", email: "responsavel@milton.edu.br", icon: <HeartHandshake className="size-4" />, id: "guardian" },
];
const HERO = "https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=1400&q=70";

export default function Login() {
  const school = useSchool();
  const me = useMe();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const login = useMutation({
    mutationFn: (body: LoginIn) => apiPost<User>("/auth/login", body),
    onSuccess: (u) => {
      beginSession();
      toast.success(`Bem-vindo(a), ${u.name.split(" ")[0]}!`);
      nav(homeFor(u), { replace: true });
    },
    onError: (e) => toast.error(errorMessage(e, "Não foi possível entrar")),
  });

  if (me.data) return <Navigate to={homeFor(me.data)} replace />;

  return (
    <div className="min-h-dvh grid lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden lg:flex flex-col justify-between p-10 text-white overflow-hidden bg-school-deep">
        <div className="absolute inset-x-0 top-0 h-2 school-stripe z-10" aria-hidden />
        <img src={HERO} alt="Estudantes sorrindo estudando juntos" className="absolute inset-0 size-full object-cover opacity-30 decor" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A1A4F]/95 via-[#14307F]/70 to-[#2148C9]/30" aria-hidden />
        <div className="relative flex items-center gap-3">
          <SchoolLogo school={school} size={84} />
          <div>
            <p className="font-heading text-xl font-bold" data-testid="login-school-name">{school.name}</p>
            <p className="text-sm text-white/80">{school.city}{school.diretoria ? ` · ${school.diretoria}` : ""}</p>
          </div>
        </div>
        <div className="relative max-w-lg">
          <MiltonMark big className="text-white [&_.text-brand]:text-school-yellow" />
          <p className="mt-4 text-2xl font-heading font-semibold leading-snug">Plataforma Inteligente de Aprendizagem e Gamificação Educacional</p>
          <p className="mt-3 text-white/80">Trilhas do Currículo Paulista, quizzes, Missão ENEM e um tutor de I.A que fala a sua língua. Estude todo dia, ganhe XP e suba no ranking!</p>
          <div className="mt-6 flex flex-wrap gap-2">
            {["🔥 Sequência diária", "🏆 Medalhas", "🎯 BNCC + SEDUC-SP", "🤖 Tutor I.A"].map((t) => (
              <span key={t} className="rounded-full bg-white/95 px-3 py-1.5 text-sm font-semibold text-school-deep">{t}</span>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-white/70 flex items-center gap-2"><span className="h-2 w-10 rounded-full school-stripe" aria-hidden />Alinhado ao Currículo Paulista, Currículo Priorizado e à BNCC.</p>
      </section>

      <section className="flex flex-col px-5 py-6 md:px-12 dot-grid">
        <div className="flex justify-end gap-1"><AccessibilityMenu /><ThemeToggle /></div>
        <div className="my-auto w-full max-w-md mx-auto">
          <div className="lg:hidden flex flex-col items-start gap-4 mb-8">
            <div className="flex items-center gap-3">
              <SchoolLogo school={school} size={64} />
              <div><p className="font-heading font-bold text-school" data-testid="login-school-name-mobile">{school.name}</p><p className="text-xs text-muted-foreground">{school.diretoria}</p></div>
            </div>
            <MiltonMark big />
          </div>
          <div className="card-tactile p-6 md:p-8 relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-1.5 school-stripe" aria-hidden />
            <h1 className="text-2xl font-bold">Entrar</h1>
            <p className="text-sm text-muted-foreground mt-1">Use seu e-mail institucional.</p>
            <form className="mt-6 space-y-4" onSubmit={(e) => { e.preventDefault(); login.mutate({ email, password }); }}>
              <div className="space-y-1.5">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seunome@milton.edu.br" data-testid="login-email-input" className="h-11" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Senha</Label>
                <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} data-testid="login-password-input" className="h-11" />
              </div>
              <Button type="submit" size="lg" className="w-full h-12 btn-3d text-base bg-school hover:bg-school/90 text-white" disabled={login.isPending} data-testid="login-submit-button">
                {login.isPending ? <Loader2 className="animate-spin" /> : <Zap />} Entrar
              </Button>
            </form>
          </div>
          <div className="mt-6">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Acesso de demonstração (senha: milton123)</p>
            <div className="grid grid-cols-2 gap-2">
              {DEMOS.map((d) => (
                <Button key={d.id} variant="outline" className={`justify-start h-11 bg-card ${d.id === "guardian" ? "col-span-2" : ""}`} data-testid={`demo-login-${d.id}`} disabled={login.isPending}
                  onClick={() => { setEmail(d.email); setPassword("milton123"); login.mutate({ email: d.email, password: "milton123" }); }}>
                  {d.icon}<span className="truncate">{d.label}</span>
                </Button>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

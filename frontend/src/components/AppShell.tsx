import { useState, type ReactNode } from "react";
import { Link, NavLink, Navigate, Outlet, useLocation } from "react-router-dom";
import {
  BarChart3, BookOpen, Bot, Flame, GraduationCap, HeartHandshake, Home, Images, LibraryBig, LogOut, Map, Menu, ShieldCheck, Swords, Trophy, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import AccessibilityMenu, { ThemeToggle } from "@/components/AccessibilityMenu";
import { Avatar, MiltonMark, SchoolLogo, Skeleton } from "@/components/common";
import { ApiError } from "@/lib/api";
import { useMe, useSchool } from "@/lib/hooks";
import { endSession } from "@/lib/session";
import { ROLE_LABEL, type Role, type User } from "@/lib/types";
import { cn } from "@/lib/utils";

interface NavItem { to: string; label: string; icon: ReactNode; id: string }
const I = "size-5";
const NAV: Record<Role, NavItem[]> = {
  student: [
    { to: "/estudante", label: "Início", icon: <Home className={I} />, id: "inicio" },
    { to: "/trilhas", label: "Trilhas", icon: <Map className={I} />, id: "trilhas" },
    { to: "/enem", label: "Missão ENEM", icon: <GraduationCap className={I} />, id: "enem" },
    { to: "/tutor", label: "Milton I.A Tutor", icon: <Bot className={I} />, id: "tutor" },
    { to: "/duelos", label: "Duelos", icon: <Swords className={I} />, id: "duelos" },
    { to: "/mural", label: "Mural Milton I.A", icon: <Images className={I} />, id: "mural" },
    { to: "/biblioteca", label: "Central de Estudos", icon: <LibraryBig className={I} />, id: "biblioteca" },
    { to: "/ranking", label: "Ranking", icon: <Trophy className={I} />, id: "ranking" },
    { to: "/progresso", label: "Meu Progresso", icon: <BarChart3 className={I} />, id: "progresso" },
  ],
  guardian: [
    { to: "/familia", label: "Resumo semanal", icon: <HeartHandshake className={I} />, id: "familia" },
    { to: "/mural", label: "Mural Milton I.A", icon: <Images className={I} />, id: "mural" },
    { to: "/biblioteca", label: "Central de Estudos", icon: <LibraryBig className={I} />, id: "biblioteca" },
  ],
  teacher: [
    { to: "/professor", label: "Painel do Professor", icon: <BookOpen className={I} />, id: "professor" },
    { to: "/trilhas", label: "Trilhas", icon: <Map className={I} />, id: "trilhas" },
    { to: "/mural", label: "Mural Milton I.A", icon: <Images className={I} />, id: "mural" },
    { to: "/biblioteca", label: "Central de Estudos", icon: <LibraryBig className={I} />, id: "biblioteca" },
    { to: "/tutor", label: "Milton I.A Tutor", icon: <Bot className={I} />, id: "tutor" },
    { to: "/ranking", label: "Ranking", icon: <Trophy className={I} />, id: "ranking" },
  ],
  manager: [
    { to: "/gestor", label: "Painel do Gestor", icon: <ShieldCheck className={I} />, id: "gestor" },
    { to: "/professor", label: "Painel do Professor", icon: <BookOpen className={I} />, id: "professor" },
    { to: "/mural", label: "Mural Milton I.A", icon: <Images className={I} />, id: "mural" },
    { to: "/biblioteca", label: "Central de Estudos", icon: <LibraryBig className={I} />, id: "biblioteca" },
    { to: "/tutor", label: "Milton I.A Tutor", icon: <Bot className={I} />, id: "tutor" },
    { to: "/ranking", label: "Ranking", icon: <Trophy className={I} />, id: "ranking" },
  ],
};

function NavList({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1" aria-label="Navegação principal">
      {items.map((it) => (
        <NavLink key={it.to} to={it.to} onClick={onNavigate} data-testid={`nav-${it.id}`}
          className={({ isActive }) => cn(
            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors duration-150",
            isActive ? "bg-accent text-accent-foreground ring-1 ring-brand/30" : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}>
          {it.icon}{it.label}
        </NavLink>
      ))}
    </nav>
  );
}

function UserMenu({ user }: { user: User }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" className="gap-2 px-1.5" data-testid="user-menu-button" />}>
        <Avatar name={user.name} color={user.avatar_color} size={32} />
        <span className="hidden md:block text-sm font-semibold max-w-32 truncate">{user.name.split(" ")[0]}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <div className="font-semibold text-foreground" data-testid="user-menu-name">{user.name}</div>
            <div className="text-xs text-muted-foreground">{ROLE_LABEL[user.role]} · {user.email}</div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" data-testid="logout-button" onClick={() => void endSession()}>
          <LogOut /> Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { data } = useMe();
  if (data && !roles.includes(data.role)) {
    return <div className="card-tactile p-8 text-center" data-testid="access-denied">Esta área é restrita a {roles.map((r) => ROLE_LABEL[r]).join(" / ")}.</div>;
  }
  return <>{children}</>;
}

export default function AppShell() {
  const me = useMe();
  const school = useSchool();
  const loc = useLocation();
  const [open, setOpen] = useState(false);

  if (me.isError && me.error instanceof ApiError && me.error.status === 401) {
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  }
  const user = me.data;
  const items = user ? NAV[user.role] : NAV.student;
  const mobileMain = items.slice(0, 4);
  const cols = mobileMain.length === 4 ? "grid-cols-4" : "grid-cols-3";

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[264px_1fr]">
      <aside className="hidden lg:flex flex-col gap-6 border-r bg-sidebar px-4 py-5 sticky top-0 h-dvh">
        <Link to="/" className="flex items-center gap-3" data-testid="sidebar-school-link">
          <SchoolLogo school={school} size={44} />
          <div className="min-w-0">
            <div className="text-sm font-bold leading-tight truncate" data-testid="sidebar-school-name">{school.name}</div>
            <div className="text-xs text-muted-foreground truncate">{school.city}</div>
          </div>
        </Link>
        <MiltonMark />
        <NavList items={items} />
        {user?.role !== "guardian" && <div className="mt-auto card-tactile p-4 bg-tutor/10 decor">
          <p className="text-sm font-bold flex items-center gap-2"><Bot className="size-4 text-tutor" /> Dúvida agora?</p>
          <p className="text-xs text-muted-foreground mt-1">O Milton I.A Tutor explica qualquer conteúdo no seu nível.</p>
          <Link to="/tutor" className="mt-3 inline-flex text-xs font-bold text-tutor hover:underline" data-testid="sidebar-tutor-cta">Abrir Tutor →</Link>
        </div>}
      </aside>

      <div className="min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 glass border-b">
          <div className="flex items-center gap-2 px-4 md:px-6 h-16">
            <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menu" data-testid="mobile-menu-button" onClick={() => setOpen(true)}><Menu /></Button>
            <div className="lg:hidden flex items-center gap-2 min-w-0">
              <SchoolLogo school={school} size={32} />
              <MiltonMark className="[&_span:last-child]:text-lg" />
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              {user?.role === "student" && (
                <>
                  <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-xp/15 px-3 py-1 text-sm font-bold text-amber-700 dark:text-xp" data-testid="header-xp-pill" aria-label={`${user.xp} pontos de experiência`}>
                    <Zap className="size-4" /> {user.xp} XP
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-streak/15 px-3 py-1 text-sm font-bold text-streak" data-testid="header-streak-pill" aria-label={`Sequência de ${user.streak} dias`}>
                    <Flame className={cn("size-4", user.streak > 0 && "animate-flame")} /> {user.streak}
                  </span>
                </>
              )}
              <AccessibilityMenu />
              <ThemeToggle />
              {user ? <UserMenu user={user} /> : <Skeleton className="size-8 rounded-full" />}
            </div>
          </div>
        </header>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="left" className="w-72 p-4">
            <SheetTitle className="sr-only">Menu</SheetTitle>
            <div className="flex items-center gap-3 mb-4 mt-2">
              <SchoolLogo school={school} size={40} />
              <div className="text-sm font-bold">{school.name}</div>
            </div>
            <NavList items={items} onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>

        <main className="flex-1 px-4 md:px-8 py-6 md:py-8 pb-28 lg:pb-10 max-w-7xl w-full" id="conteudo">
          <Outlet />
        </main>

        <nav className={cn("lg:hidden fixed bottom-0 inset-x-0 z-30 glass border-t grid", cols)} aria-label="Navegação inferior">
          {mobileMain.map((it) => (
            <NavLink key={it.to} to={it.to} data-testid={`bottom-nav-${it.id}`}
              className={({ isActive }) => cn("flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold", isActive ? "text-brand" : "text-muted-foreground")}>
              {it.icon}<span className="truncate max-w-20">{it.label.replace("Milton I.A ", "")}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}

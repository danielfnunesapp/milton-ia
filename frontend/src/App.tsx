import { Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import AppShell, { RequireRole } from "@/components/AppShell";
import { Skeleton } from "@/components/common";
import { homeFor, useMe } from "@/lib/hooks";
import { PrefsProvider } from "@/lib/prefs";
import Login from "@/pages/Login";
import StudentHome from "@/pages/StudentHome";
import Trilhas from "@/pages/Trilhas";
import QuizPlay from "@/pages/QuizPlay";
import Progresso from "@/pages/Progresso";
import Ranking from "@/pages/Ranking";
import Enem from "@/pages/Enem";
import Biblioteca from "@/pages/Biblioteca";
import Mural from "@/pages/Mural";
import Tutor from "@/pages/Tutor";
import Professor from "@/pages/Professor";
import Gestor from "@/pages/Gestor";
import Duelos from "@/pages/Duelos";
import Familia from "@/pages/Familia";

function HomeRedirect() {
  const { data, isError } = useMe();
  if (isError) return <Navigate to="/login" replace />;
  if (!data) return <Skeleton className="h-40" />;
  return <Navigate to={homeFor(data)} replace />;
}

export default function App() {
  return (
    <PrefsProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<AppShell />}>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/estudante" element={<RequireRole roles={["student"]}><StudentHome /></RequireRole>} />
          <Route path="/progresso" element={<RequireRole roles={["student"]}><Progresso /></RequireRole>} />
          <Route path="/trilhas" element={<Trilhas />} />
          <Route path="/quiz/:id" element={<QuizPlay />} />
          <Route path="/ranking" element={<Ranking />} />
          <Route path="/enem" element={<Enem />} />
          <Route path="/biblioteca" element={<Biblioteca />} />
          <Route path="/mural" element={<Mural />} />
          <Route path="/tutor" element={<Tutor />} />
          <Route path="/professor" element={<RequireRole roles={["teacher", "manager"]}><Professor /></RequireRole>} />
          <Route path="/duelos" element={<RequireRole roles={["student"]}><Duelos /></RequireRole>} />
          <Route path="/familia" element={<RequireRole roles={["guardian"]}><Familia /></RequireRole>} />
          <Route path="/gestor" element={<RequireRole roles={["manager"]}><Gestor /></RequireRole>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster richColors />
    </PrefsProvider>
  );
}

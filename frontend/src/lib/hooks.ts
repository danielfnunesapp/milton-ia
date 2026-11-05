import { useQuery } from "@tanstack/react-query";
import { apiGet } from "./api";
import type { School, User } from "./types";

export const DEFAULT_SCHOOL: School = { name: "E.E. Prof. Milton Leme do Prado", logo_url: "/logo-milton.png", city: "São Paulo - SP", diretoria: "Programa Ensino Integral" };

export function useMe() {
  return useQuery({ queryKey: ["me"], queryFn: () => apiGet<User>("/auth/me"), retry: false });
}

export function useSchool() {
  const q = useQuery({ queryKey: ["school"], queryFn: () => apiGet<School>("/school") });
  return q.isError || !q.data ? DEFAULT_SCHOOL : q.data;
}

const HOME: Record<User["role"], string> = { student: "/estudante", teacher: "/professor", manager: "/gestor", guardian: "/familia" };
export const homeFor = (u: User) => HOME[u.role];

export function fmtDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

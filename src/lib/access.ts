import type { AppRole } from "@/lib/roles";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

// Menus whose access admin S can tune per user (Setări is always admin S only).
export const MENUS = [
  { key: "dashboard", label: "Pipeline & Dashboard" },
  { key: "clienti", label: "Clienți" },
  { key: "programari", label: "Programări" },
  { key: "proiecte", label: "Proiecte" },
  { key: "editori", label: "Canale" },
  { key: "echipa", label: "Echipă" },
  { key: "documente", label: "Documente & Contracte" },
  { key: "financiar", label: "Financiar" },
  { key: "automatizari", label: "Automatizări" },
  { key: "portal", label: "Portal client" },
] as const;

export type MenuKey = (typeof MENUS)[number]["key"];
export type Access = Record<MenuKey, { view: boolean; edit: boolean }>;
export type AccessKind = "view" | "edit";

// Mirrors public.role_default() in the database.
export function roleDefault(role: AppRole, menu: MenuKey, kind: AccessKind): boolean {
  if (role === "admin") return menu !== "portal" || kind === "view";
  switch (menu) {
    case "dashboard":
    case "clienti":
    case "programari":
    case "documente":
      return role === "manager" || role === "vanzari";
    case "proiecte":
    case "editori":
      return role === "manager" || role === "editor";
    case "financiar":
    case "automatizari":
      return role === "manager";
    case "echipa":
    case "portal":
      return role === "manager" && kind === "view";
  }
}

export function defaultAccess(role: AppRole): Access {
  return Object.fromEntries(
    MENUS.map((m) => [m.key, { view: roleDefault(role, m.key, "view"), edit: roleDefault(role, m.key, "edit") }]),
  ) as Access;
}

// Effective access of the signed-in user (role default + admin S overrides), computed in the database.
// Pages start the request right after auth (accessRequest) and resolve it once the role is known.
export function accessRequest(supabase: SupabaseClient<Database>) {
  return Promise.resolve(supabase.rpc("my_access"));
}

export function resolveAccess(data: unknown, role: AppRole): Access {
  const base = defaultAccess(role);
  return data && typeof data === "object" ? { ...base, ...(data as Partial<Access>) } : base;
}

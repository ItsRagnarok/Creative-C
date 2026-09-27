import type { Enums } from "@/lib/supabase/database.types";

export type AutomationKind = Enums<"automation_kind">;

export const AUTOMATION_UNIT: Record<AutomationKind, string> = {
  lead_inactiv: "zile",
  document_expira: "zile",
  factura_restanta: "zile",
  stoc_clipuri_redus: "clipuri",
};

export const AUTOMATION_ICON: Record<AutomationKind, string> = {
  lead_inactiv: "⏰",
  document_expira: "📄",
  factura_restanta: "💸",
  stoc_clipuri_redus: "🎬",
};

export function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "acum";
  if (mins < 60) return `acum ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `acum ${hours} h`;
  const days = Math.round(hours / 24);
  return `acum ${days} zile`;
}

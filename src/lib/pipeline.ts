import type { Enums } from "@/lib/supabase/database.types";

export type LeadStage = Enums<"lead_stage">;

export const STAGES: { key: LeadStage; label: string; help: string }[] = [
  {
    key: "nou",
    label: "Nou",
    help: "Closerul a apăsat că e lead — intră aici automat.",
  },
  {
    key: "discutie",
    label: "În discuție",
    help: 'Trece aici singur când s-a setat un meeting. Fără activitate 3 zile → apare la „Follow-up-uri întârziate”.',
  },
  {
    key: "confirmat",
    label: "Status",
    help: "Aici closerul alege rezultatul: Pending, Confirmat sau Pierdut (cu motivul pierderii). La Confirmat, managerii și adminii primesc o notificare ca să creeze clientul.",
  },
];

export type LeadStatus = "pending" | "confirmat" | "pierdut";
export const LEAD_STATUSES: { key: LeadStatus; label: string; badge: string }[] = [
  { key: "pending", label: "Pending", badge: "amber" },
  { key: "confirmat", label: "Confirmat", badge: "green" },
  { key: "pierdut", label: "Pierdut", badge: "red" },
];
export const STATUS_LABEL: Record<LeadStatus, string> = Object.fromEntries(LEAD_STATUSES.map((s) => [s.key, s.label])) as Record<LeadStatus, string>;
export const STATUS_BADGE: Record<LeadStatus, string> = Object.fromEntries(LEAD_STATUSES.map((s) => [s.key, s.badge])) as Record<LeadStatus, string>;

export const STAGE_LABEL: Record<LeadStage, string> = Object.fromEntries(
  STAGES.map((s) => [s.key, s.label]),
) as Record<LeadStage, string>;

export const STAGE_BADGE: Record<LeadStage, string> = {
  nou: "blue",
  discutie: "amber",
  confirmat: "violet",
  lucru: "green",
  finalizat: "gray",
};

export function monthYear(iso: string) {
  return new Date(iso).toLocaleDateString("ro-RO", { month: "long", year: "numeric" });
}

export function daysSince(iso: string) {
  return (Date.now() - new Date(iso).getTime()) / 86_400_000;
}

export function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "acum";
  if (mins < 60) return `acum ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `acum ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `acum ${days} zile`;
  const months = Math.round(days / 30);
  return `acum ${months} luni`;
}

export function formatLei(value: number) {
  return `${new Intl.NumberFormat("ro-RO").format(value)} lei`;
}

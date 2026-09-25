import type { Enums } from "@/lib/supabase/database.types";

export type LeadStage = Enums<"lead_stage">;

export const STAGES: { key: LeadStage; label: string; help: string }[] = [
  {
    key: "nou",
    label: "Nou",
    help: "Lead abia intrat în sistem — nu a fost încă contactat sau discuția e la început.",
  },
  {
    key: "discutie",
    label: "În discuție",
    help: 'Am luat legătura și discutăm oferta. Fără activitate 3 zile aici → apare la „Follow-up-uri întârziate”.',
  },
  {
    key: "confirmat",
    label: "Confirmat",
    help: "Clientul a acceptat oferta/pachetul. Urmează contractul și prima factură.",
  },
  {
    key: "lucru",
    label: "În lucru",
    help: "Client activ, cu proiect sau abonament lunar în derulare.",
  },
  {
    key: "finalizat",
    label: "Finalizat",
    help: "Proiect încheiat sau colaborare oprită. Rămâne în istoric, dar nu mai e activ în pipeline.",
  },
];

export const STAGE_LABEL: Record<LeadStage, string> = Object.fromEntries(
  STAGES.map((s) => [s.key, s.label]),
) as Record<LeadStage, string>;

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

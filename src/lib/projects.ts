import type { Enums } from "@/lib/supabase/database.types";

export type ProjectStage = Enums<"project_stage">;

export const PROJECT_STAGES: { key: ProjectStage; label: string }[] = [
  { key: "de_pornit", label: "De pornit" },
  { key: "filmare", label: "În filmare" },
  { key: "montaj", label: "În montaj" },
  { key: "revizuire_client", label: "În revizuire client" },
  { key: "finalizat", label: "Finalizat" },
];

export const PROJECT_STAGE_LABEL: Record<ProjectStage, string> = Object.fromEntries(
  PROJECT_STAGES.map((s) => [s.key, s.label]),
) as Record<ProjectStage, string>;

export function formatDeadline(iso: string) {
  return new Date(iso).toLocaleDateString("ro-RO", { day: "numeric", month: "short" });
}

export function projectBadge(stage: ProjectStage, deadline: string | null, today: Date) {
  if (stage === "revizuire_client") return { text: "așteaptă aprobare", color: "blue" };
  if (stage === "finalizat") return { text: deadline ? `predat ${formatDeadline(deadline)}` : "finalizat", color: "green" };
  if (!deadline) return { text: "fără deadline", color: "gray" };
  const days = Math.round((new Date(deadline).getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return { text: `întârziat ${Math.abs(days)} ${Math.abs(days) === 1 ? "zi" : "zile"}`, color: "red" };
  return { text: `deadline ${formatDeadline(deadline)}`, color: "amber" };
}

export const FILE_KIND_ICON: Record<string, string> = {
  folder: "📁",
  video: "🎬",
  doc: "📄",
  file: "📎",
};

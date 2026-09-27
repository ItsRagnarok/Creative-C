import type { Enums } from "@/lib/supabase/database.types";

export type DocumentType = Enums<"document_type">;
export type DocumentStatus = Enums<"document_status">;

export const DOCUMENT_TYPE_LABEL: Record<DocumentType, string> = {
  contract: "Contract",
  anexa: "Anexă",
  oferta: "Ofertă",
  altul: "Altul",
};

export const DOCUMENT_TYPE_ICON: Record<DocumentType, string> = {
  contract: "📄",
  anexa: "📎",
  oferta: "🧾",
  altul: "🗂",
};

export const DOCUMENT_STATUSES: { key: DocumentStatus; label: string }[] = [
  { key: "draft", label: "Draft" },
  { key: "trimis", label: "Trimis" },
  { key: "semnat", label: "Semnat" },
  { key: "expirat", label: "Expirat" },
];

export const DOCUMENT_STATUS_LABEL: Record<DocumentStatus, string> = Object.fromEntries(
  DOCUMENT_STATUSES.map((s) => [s.key, s.label]),
) as Record<DocumentStatus, string>;

export const DOCUMENT_STATUS_BADGE: Record<DocumentStatus, string> = {
  draft: "gray",
  trimis: "blue",
  semnat: "green",
  expirat: "red",
};

export function effectiveStatus(status: DocumentStatus, expiryDate: string | null, today: Date): DocumentStatus {
  if (status === "semnat" && expiryDate && new Date(expiryDate) < today) return "expirat";
  return status;
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ro-RO", { day: "numeric", month: "short", year: "numeric" });
}

export function formatLei(value: number) {
  return `${new Intl.NumberFormat("ro-RO").format(value)} lei`;
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

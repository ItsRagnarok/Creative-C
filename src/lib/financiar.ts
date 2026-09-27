import type { Enums } from "@/lib/supabase/database.types";

export type InvoiceStatus = Enums<"invoice_status">;

export const INVOICE_STATUSES: { key: InvoiceStatus; label: string }[] = [
  { key: "neplatita", label: "Neplătită" },
  { key: "platita", label: "Plătită" },
  { key: "restanta", label: "Restantă" },
  { key: "anulata", label: "Anulată" },
];

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = Object.fromEntries(
  INVOICE_STATUSES.map((s) => [s.key, s.label]),
) as Record<InvoiceStatus, string>;

export const INVOICE_STATUS_BADGE: Record<InvoiceStatus, string> = {
  neplatita: "blue",
  platita: "green",
  restanta: "red",
  anulata: "gray",
};

export function effectiveInvoiceStatus(status: InvoiceStatus, dueDate: string | null, today: Date): InvoiceStatus {
  if (status === "neplatita" && dueDate && new Date(dueDate) < today) return "restanta";
  return status;
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ro-RO", { day: "numeric", month: "short", year: "numeric" });
}

export function formatLei(value: number) {
  return `${new Intl.NumberFormat("ro-RO").format(value)} lei`;
}

export function daysOverdue(dueDate: string, today: Date) {
  return Math.round((today.getTime() - new Date(dueDate).getTime()) / 86_400_000);
}

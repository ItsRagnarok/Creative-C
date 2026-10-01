"use client";

import { useMemo, useState } from "react";
import { PROJECT_STAGE_LABEL, projectBadge, type ProjectStage } from "@/lib/projects";
import { DOCUMENT_STATUS_LABEL, DOCUMENT_STATUS_BADGE, DOCUMENT_TYPE_LABEL, effectiveStatus, formatDate as formatDocDate, type DocumentStatus, type DocumentType } from "@/lib/documents";
import { INVOICE_STATUS_LABEL, INVOICE_STATUS_BADGE, effectiveInvoiceStatus, formatLei, type InvoiceStatus } from "@/lib/financiar";

export type ClientOption = { id: string; name: string };
export type PortalProjectRow = { id: string; title: string; lead_id: string | null; stage: ProjectStage; deadline: string | null };
export type PortalDocumentRow = { id: string; title: string; lead_id: string | null; type: DocumentType; status: DocumentStatus; expiry_date: string | null };
export type PortalInvoiceRow = { id: string; number: string; lead_id: string | null; amount: number; status: InvoiceStatus; due_date: string | null };

export default function PortalClientBoard({
  clients,
  projects,
  documents,
  invoices,
}: {
  clients: ClientOption[];
  projects: PortalProjectRow[];
  documents: PortalDocumentRow[];
  invoices: PortalInvoiceRow[];
}) {
  const [selectedId, setSelectedId] = useState(clients[0]?.id ?? "");
  const [today] = useState(() => new Date());

  const clientProjects = useMemo(() => projects.filter((p) => p.lead_id === selectedId), [projects, selectedId]);
  const clientDocuments = useMemo(() => documents.filter((d) => d.lead_id === selectedId), [documents, selectedId]);
  const clientInvoices = useMemo(() => invoices.filter((i) => i.lead_id === selectedId), [invoices, selectedId]);

  const totalDue = useMemo(
    () =>
      clientInvoices
        .filter((i) => effectiveInvoiceStatus(i.status, i.due_date, today) !== "platita" && i.status !== "anulata")
        .reduce((sum, i) => sum + Number(i.amount), 0),
    [clientInvoices, today],
  );

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Portal client (preview)</h1>
          <p>Ce ar vedea clientul dacă ar avea cont propriu — stadiul proiectelor, documentele și facturile lui, într-un singur loc.</p>
        </div>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", fontSize: 13, minWidth: 220 }}
        >
          <option value="">— alege un client —</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {!selectedId ? (
        <div className="empty-note">Alege un client din listă ca să vezi previzualizarea portalului lui.</div>
      ) : (
        <>
          <div className="grid g-3" style={{ marginBottom: 24 }}>
            <div className="card kpi">
              <div className="label">Proiecte active</div>
              <div className="value">{clientProjects.filter((p) => p.stage !== "finalizat").length}</div>
              <div className="delta up">{clientProjects.length} în total</div>
            </div>
            <div className="card kpi">
              <div className="label">Documente</div>
              <div className="value">{clientDocuments.length}</div>
              <div className="delta up">{clientDocuments.filter((d) => d.status === "semnat").length} semnate</div>
            </div>
            <div className="card kpi">
              <div className="label">Sold neachitat</div>
              <div className="value">{formatLei(totalDue)}</div>
              <div className="delta up">{clientInvoices.length} facturi în total</div>
            </div>
          </div>

          <div className="section-title"><h2>Proiecte</h2></div>
          <div className="card" style={{ padding: 0, marginBottom: 24 }}>
            <div className="list" style={{ padding: "4px 18px" }}>
              {clientProjects.map((p) => {
                const badge = projectBadge(p.stage, p.deadline, today);
                return (
                  <div key={p.id} className="list-row">
                    <span style={{ flex: 1, fontSize: 13 }}>{p.title}</span>
                    <span className="faint" style={{ fontSize: 12 }}>{PROJECT_STAGE_LABEL[p.stage]}</span>
                    <span className={`badge ${badge.color}`}>{badge.text}</span>
                  </div>
                );
              })}
              {clientProjects.length === 0 && <div className="empty-note">Niciun proiect pentru acest client.</div>}
            </div>
          </div>

          <div className="section-title"><h2>Documente</h2></div>
          <div className="card" style={{ padding: 0, marginBottom: 24 }}>
            <div className="list" style={{ padding: "4px 18px" }}>
              {clientDocuments.map((d) => {
                const st = effectiveStatus(d.status, d.expiry_date, today);
                return (
                  <div key={d.id} className="list-row">
                    <span style={{ flex: 1, fontSize: 13 }}>{d.title}</span>
                    <span className="faint" style={{ fontSize: 12 }}>{DOCUMENT_TYPE_LABEL[d.type]}</span>
                    <span className={`badge ${DOCUMENT_STATUS_BADGE[st]}`}>{DOCUMENT_STATUS_LABEL[st]}</span>
                  </div>
                );
              })}
              {clientDocuments.length === 0 && <div className="empty-note">Niciun document pentru acest client.</div>}
            </div>
          </div>

          <div className="section-title"><h2>Facturi</h2></div>
          <div className="card" style={{ padding: 0 }}>
            <div className="list" style={{ padding: "4px 18px" }}>
              {clientInvoices.map((i) => {
                const st = effectiveInvoiceStatus(i.status, i.due_date, today);
                return (
                  <div key={i.id} className="list-row">
                    <span style={{ flex: 1, fontSize: 13 }}>{i.number}</span>
                    <span className="faint" style={{ fontSize: 12 }}>
                      {i.due_date ? `scadentă ${formatDocDate(i.due_date)}` : "fără scadență"}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{formatLei(Number(i.amount))}</span>
                    <span className={`badge ${INVOICE_STATUS_BADGE[st]}`}>{INVOICE_STATUS_LABEL[st]}</span>
                  </div>
                );
              })}
              {clientInvoices.length === 0 && <div className="empty-note">Nicio factură pentru acest client.</div>}
            </div>
          </div>
        </>
      )}
    </>
  );
}

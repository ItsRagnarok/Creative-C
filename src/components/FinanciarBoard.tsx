"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Owner } from "@/components/PipelineBoard";
import {
  INVOICE_STATUSES,
  INVOICE_STATUS_LABEL,
  INVOICE_STATUS_BADGE,
  effectiveInvoiceStatus,
  formatDate,
  formatLei,
  daysOverdue,
  type InvoiceStatus,
} from "@/lib/financiar";
import { OWNER_LEAD_SELECT } from "@/lib/selects";

export type InvoiceRow = {
  id: string;
  number: string;
  lead_id: string | null;
  document_id: string | null;
  amount: number;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string | null;
  paid_date: string | null;
  notes: string | null;
  owner_id: string | null;
  created_at: string;
  owner: Owner | null;
  lead: { id: string; name: string } | null;
};

type LeadOption = { id: string; name: string };
type DocumentOption = { id: string; title: string; lead_id: string | null; value_total: number | null };

type InvoiceForm = {
  id?: string;
  lead_id: string;
  document_id: string;
  amount: string;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string;
  paid_date: string;
  owner_id: string;
  notes: string;
};

const CONFIRM_WORD = "STERGE";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function emptyForm(owners: Owner[]): InvoiceForm {
  return {
    lead_id: "",
    document_id: "",
    amount: "",
    status: "neplatita",
    issue_date: todayIso(),
    due_date: "",
    paid_date: "",
    owner_id: owners[0]?.id ?? "",
    notes: "",
  };
}

export default function FinanciarBoard({
  initialInvoices,
  leads,
  documents,
  owners,
}: {
  initialInvoices: InvoiceRow[];
  leads: LeadOption[];
  documents: DocumentOption[];
  owners: Owner[];
}) {
  const supabase = createClient();
  const [invoices, setInvoices] = useState(initialInvoices);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "toate">("toate");
  const [modal, setModal] = useState<null | { mode: "create" | "edit"; form: InvoiceForm }>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmIds, setConfirmIds] = useState<string[] | null>(null);
  const [confirmStep, setConfirmStep] = useState<1 | 2>(1);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [today] = useState(() => new Date());

  const filtered = useMemo(() => {
    return invoices.filter((inv) => {
      if (search && !inv.number.toLowerCase().includes(search.toLowerCase()) && !(inv.lead?.name.toLowerCase().includes(search.toLowerCase()))) return false;
      if (statusFilter !== "toate" && effectiveInvoiceStatus(inv.status, inv.due_date, today) !== statusFilter) return false;
      return true;
    });
  }, [invoices, search, statusFilter, today]);

  const kpis = useMemo(() => {
    const isPaidThisMonth = (inv: InvoiceRow) =>
      inv.status === "platita" && inv.paid_date &&
      new Date(inv.paid_date).getMonth() === today.getMonth() &&
      new Date(inv.paid_date).getFullYear() === today.getFullYear();
    const isPaidThisYear = (inv: InvoiceRow) =>
      inv.status === "platita" && inv.paid_date && new Date(inv.paid_date).getFullYear() === today.getFullYear();

    const monthRevenue = invoices.filter(isPaidThisMonth).reduce((sum, inv) => sum + inv.amount, 0);
    const yearRevenue = invoices.filter(isPaidThisYear).reduce((sum, inv) => sum + inv.amount, 0);
    const overdue = invoices.filter((inv) => effectiveInvoiceStatus(inv.status, inv.due_date, today) === "restanta");
    const overdueSum = overdue.reduce((sum, inv) => sum + inv.amount, 0);
    const outstanding = invoices
      .filter((inv) => inv.status === "neplatita" || inv.status === "restanta")
      .reduce((sum, inv) => sum + inv.amount, 0);

    return { monthRevenue, yearRevenue, overdueCount: overdue.length, overdueSum, outstanding };
  }, [invoices, today]);

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openCreate() {
    setError(null);
    setModal({ mode: "create", form: emptyForm(owners) });
  }

  function openEdit(inv: InvoiceRow) {
    setError(null);
    setModal({
      mode: "edit",
      form: {
        id: inv.id,
        lead_id: inv.lead_id ?? "",
        document_id: inv.document_id ?? "",
        amount: String(inv.amount),
        status: inv.status,
        issue_date: inv.issue_date,
        due_date: inv.due_date ?? "",
        paid_date: inv.paid_date ?? "",
        owner_id: inv.owner_id ?? "",
        notes: inv.notes ?? "",
      },
    });
  }

  function applyDocument(documentId: string, form: InvoiceForm): InvoiceForm {
    const doc = documents.find((d) => d.id === documentId);
    if (!doc) return { ...form, document_id: documentId };
    return {
      ...form,
      document_id: documentId,
      lead_id: form.lead_id || doc.lead_id || "",
      amount: form.amount || (doc.value_total != null ? String(doc.value_total) : form.amount),
    };
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!modal) return;
    const { form, mode } = modal;
    const amount = Number(form.amount);
    if (!amount || amount <= 0) {
      setError("Suma trebuie să fie mai mare decât 0.");
      return;
    }
    if (form.status === "platita" && !form.paid_date) {
      setError("Adaugă data plății pentru o factură marcată „plătită”.");
      return;
    }
    setSaving(true);
    setError(null);

    const payload = {
      lead_id: form.lead_id || null,
      document_id: form.document_id || null,
      amount,
      status: form.status,
      issue_date: form.issue_date || todayIso(),
      due_date: form.due_date || null,
      paid_date: form.paid_date || null,
      owner_id: form.owner_id || null,
      notes: form.notes.trim() || null,
    };

    if (mode === "create") {
      const { data, error: err } = await supabase
        .from("invoices")
        .insert(payload)
        .select(OWNER_LEAD_SELECT)
        .single();
      setSaving(false);
      if (err) return setError(err.message);
      setInvoices((prev) => [data as InvoiceRow, ...prev]);
    } else {
      const { data, error: err } = await supabase
        .from("invoices")
        .update(payload)
        .eq("id", form.id!)
        .select(OWNER_LEAD_SELECT)
        .single();
      setSaving(false);
      if (err) return setError(err.message);
      setInvoices((prev) => prev.map((inv) => (inv.id === form.id ? (data as InvoiceRow) : inv)));
    }
    setModal(null);
  }

  async function markPaid(inv: InvoiceRow) {
    const { data, error: err } = await supabase
      .from("invoices")
      .update({ status: "platita", paid_date: todayIso() })
      .eq("id", inv.id)
      .select(OWNER_LEAD_SELECT)
      .single();
    if (err) return;
    setInvoices((prev) => prev.map((x) => (x.id === inv.id ? (data as InvoiceRow) : x)));
  }

  function openConfirm(ids: string[]) {
    setModal(null);
    setDeleteError(null);
    setConfirmStep(1);
    setConfirmText("");
    setConfirmIds(ids);
  }

  function closeConfirm() {
    setConfirmIds(null);
    setConfirmStep(1);
    setConfirmText("");
    setDeleteError(null);
  }

  async function handleConfirmedDelete() {
    if (!confirmIds) return;
    setDeleting(true);
    setDeleteError(null);
    const { error: err } = await supabase.from("invoices").delete().in("id", confirmIds);
    setDeleting(false);
    if (err) {
      setDeleteError(err.message);
      return;
    }
    const idSet = new Set(confirmIds);
    setInvoices((prev) => prev.filter((inv) => !idSet.has(inv.id)));
    setSelected((prev) => {
      const next = new Set(prev);
      confirmIds.forEach((id) => next.delete(id));
      return next;
    });
    closeConfirm();
  }

  const confirmTargets = confirmIds ? invoices.filter((inv) => confirmIds.includes(inv.id)) : [];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Financiar</h1>
          <p>{invoices.length} facturi · venituri, restanțe și plăți legate de clienți.</p>
        </div>
        <button className="btn primary" onClick={openCreate}>+ Factură nouă</button>
      </div>

      <div className="grid g-4" style={{ marginBottom: 18 }}>
        <div className="card kpi">
          <div className="label">Venit luna curentă</div>
          <div className="value" style={{ fontSize: 20 }}>{formatLei(kpis.monthRevenue)}</div>
          <div className="delta up">încasat, plătit efectiv</div>
        </div>
        <div className="card kpi">
          <div className="label">Venit anul curent</div>
          <div className="value" style={{ fontSize: 20 }}>{formatLei(kpis.yearRevenue)}</div>
          <div className="delta up">total facturi plătite</div>
        </div>
        <div className="card kpi">
          <div className="label">Facturi restante</div>
          <div className="value">{kpis.overdueCount}</div>
          <div className="delta down">{formatLei(kpis.overdueSum)}</div>
        </div>
        <div className="card kpi">
          <div className="label">Neîncasat total</div>
          <div className="value" style={{ fontSize: 20 }}>{formatLei(kpis.outstanding)}</div>
          <div className="delta down">neplătite + restante</div>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="card" style={{ marginBottom: 18, padding: "12px 18px", display: "flex", alignItems: "center", gap: 12 }}>
          <span className="tag">{selected.size} selectate</span>
          <button type="button" className="btn ghost sm" onClick={() => setSelected(new Set())}>Anulează selecția</button>
          <button type="button" className="btn danger sm" style={{ marginLeft: "auto" }} onClick={() => openConfirm(Array.from(selected))}>
            Șterge selectatele
          </button>
        </div>
      )}

      <div className="card" style={{ marginBottom: 18, display: "flex", gap: 10, flexWrap: "wrap", padding: "14px 18px" }}>
        <div className="search" style={{ maxWidth: 260 }}>
          🔍
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Caută factură sau client…"
            style={{ background: "transparent", border: "none", outline: "none", width: "100%", color: "var(--text)" }}
          />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as InvoiceStatus | "toate")} style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px", fontSize: 12 }}>
          <option value="toate">Status: Toate</option>
          {INVOICE_STATUSES.map((s) => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>
        <span className="tag" style={{ marginLeft: "auto" }}>{filtered.length} rezultate</span>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 34 }} />
              <th>Factură</th>
              <th>Client</th>
              <th>Status</th>
              <th>Sumă</th>
              <th>Scadență</th>
              <th>Responsabil</th>
              <th style={{ width: 44 }} />
            </tr>
          </thead>
          <tbody>
            {filtered.map((inv) => {
              const status = effectiveInvoiceStatus(inv.status, inv.due_date, today);
              return (
                <tr key={inv.id}>
                  <td>
                    <input type="checkbox" checked={selected.has(inv.id)} onChange={() => toggleSelected(inv.id)} aria-label={`Selectează ${inv.number}`} />
                  </td>
                  <td>
                    <div className="p-name mono">{inv.number}</div>
                    <div className="p-sub">{formatDate(inv.issue_date)}</div>
                  </td>
                  <td>{inv.lead ? <span className="tag">{inv.lead.name}</span> : <span className="faint">—</span>}</td>
                  <td>
                    <span className={`badge ${INVOICE_STATUS_BADGE[status]}`}>{INVOICE_STATUS_LABEL[status]}</span>
                    {status === "restanta" && inv.due_date && (
                      <div className="faint" style={{ fontSize: 10.5, marginTop: 3 }}>{daysOverdue(inv.due_date, today)} zile</div>
                    )}
                  </td>
                  <td className="mono">{formatLei(inv.amount)}</td>
                  <td className="faint">{inv.due_date ? formatDate(inv.due_date) : "—"}</td>
                  <td>
                    {inv.owner ? (
                      <div className="p-avatar" style={{ width: 26, height: 26, fontSize: 10 }}>{inv.owner.initials}</div>
                    ) : (
                      <span className="faint">—</span>
                    )}
                  </td>
                  <td style={{ display: "flex", gap: 6 }}>
                    {status !== "platita" && status !== "anulata" && (
                      <button type="button" className="btn sm ghost" title="Marchează plătită" onClick={() => markPaid(inv)}>✓</button>
                    )}
                    <button type="button" className="icon-btn" style={{ width: 28, height: 28 }} title="Editează" onClick={() => openEdit(inv)}>
                      ✎
                    </button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8}>
                  <div className="empty-note">Nicio factură nu corespunde filtrelor alese.</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{modal.mode === "create" ? "Factură nouă" : `Editează ${invoices.find((i) => i.id === modal.form.id)?.number ?? ""}`}</h3>
              <button className="modal-close" onClick={() => setModal(null)}>✕</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="field">
                <label>Contract legat (opțional)</label>
                <select value={modal.form.document_id} onChange={(e) => setModal({ ...modal, form: applyDocument(e.target.value, modal.form) })}>
                  <option value="">— fără contract —</option>
                  {documents.map((d) => (
                    <option key={d.id} value={d.id}>{d.title}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Client</label>
                <select value={modal.form.lead_id} onChange={(e) => setModal({ ...modal, form: { ...modal.form, lead_id: e.target.value } })}>
                  <option value="">— fără client —</option>
                  {leads.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid g-2">
                <div className="field">
                  <label>Sumă (lei)</label>
                  <input type="number" min="0" step="0.01" value={modal.form.amount} onChange={(e) => setModal({ ...modal, form: { ...modal.form, amount: e.target.value } })} />
                </div>
                <div className="field">
                  <label>Status</label>
                  <select value={modal.form.status} onChange={(e) => setModal({ ...modal, form: { ...modal.form, status: e.target.value as InvoiceStatus } })}>
                    {INVOICE_STATUSES.map((s) => (
                      <option key={s.key} value={s.key}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid g-2">
                <div className="field">
                  <label>Dată emitere</label>
                  <input type="date" value={modal.form.issue_date} onChange={(e) => setModal({ ...modal, form: { ...modal.form, issue_date: e.target.value } })} />
                </div>
                <div className="field">
                  <label>Scadență (opțional)</label>
                  <input type="date" value={modal.form.due_date} onChange={(e) => setModal({ ...modal, form: { ...modal.form, due_date: e.target.value } })} />
                </div>
              </div>
              <div className="grid g-2">
                <div className="field">
                  <label>Dată plată (dacă e plătită)</label>
                  <input type="date" value={modal.form.paid_date} onChange={(e) => setModal({ ...modal, form: { ...modal.form, paid_date: e.target.value } })} />
                </div>
                <div className="field">
                  <label>Responsabil</label>
                  <select value={modal.form.owner_id} onChange={(e) => setModal({ ...modal, form: { ...modal.form, owner_id: e.target.value } })}>
                    <option value="">— nealocat —</option>
                    {owners.map((o) => (
                      <option key={o.id} value={o.id}>{o.full_name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="field">
                <label>Notițe</label>
                <textarea rows={2} value={modal.form.notes} onChange={(e) => setModal({ ...modal, form: { ...modal.form, notes: e.target.value } })} />
              </div>

              {error && <div className="field-error">{error}</div>}

              <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
                {modal.mode === "edit" && (
                  <button type="button" className="btn danger" onClick={() => openConfirm([modal.form.id!])} disabled={saving}>
                    Șterge
                  </button>
                )}
                <button type="submit" className="btn primary" style={{ flex: 1, justifyContent: "center" }} disabled={saving}>
                  {saving ? "Se salvează…" : "Salvează"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmIds && (
        <div className="modal-overlay" onClick={closeConfirm}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Șterge {confirmIds.length > 1 ? `${confirmIds.length} facturi` : "factură"}</h3>
              <button className="modal-close" onClick={closeConfirm}>✕</button>
            </div>

            {confirmStep === 1 ? (
              <>
                <p style={{ marginBottom: 4 }}>
                  Sigur vrei să ștergi {confirmIds.length > 1 ? "aceste facturi" : "această factură"}?
                </p>
                <div className="list" style={{ marginBottom: 14, maxHeight: 160, overflowY: "auto" }}>
                  {confirmTargets.map((inv) => (
                    <div key={inv.id} className="list-row" style={{ padding: "8px 4px" }}>
                      <span className="p-name mono" style={{ fontSize: 13 }}>{inv.number}</span>
                    </div>
                  ))}
                </div>
                <div className="field-error" style={{ marginBottom: 14 }}>
                  Acțiunea este ireversibilă.
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button type="button" className="btn ghost" style={{ flex: 1, justifyContent: "center" }} onClick={closeConfirm}>
                    Renunță
                  </button>
                  <button type="button" className="btn danger" style={{ flex: 1, justifyContent: "center" }} onClick={() => setConfirmStep(2)}>
                    Continuă
                  </button>
                </div>
              </>
            ) : (
              <>
                <p style={{ marginBottom: 12 }}>
                  Ultima confirmare: scrie <b style={{ color: "var(--text)" }}>{CONFIRM_WORD}</b> ca să ștergi definitiv
                  {confirmIds.length > 1 ? ` cele ${confirmIds.length} facturi` : " această factură"}.
                </p>
                <div className="field">
                  <input autoFocus value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder={CONFIRM_WORD} />
                </div>
                {deleteError && <div className="field-error">{deleteError}</div>}
                <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
                  <button type="button" className="btn ghost" style={{ flex: 1, justifyContent: "center" }} onClick={() => setConfirmStep(1)} disabled={deleting}>
                    Înapoi
                  </button>
                  <button
                    type="button"
                    className="btn danger"
                    style={{ flex: 1, justifyContent: "center" }}
                    disabled={deleting || confirmText.trim().toUpperCase() !== CONFIRM_WORD}
                    onClick={handleConfirmedDelete}
                  >
                    {deleting ? "Se șterge…" : "Șterge definitiv"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

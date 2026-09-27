"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Owner } from "@/components/PipelineBoard";
import {
  DOCUMENT_STATUSES,
  DOCUMENT_STATUS_LABEL,
  DOCUMENT_STATUS_BADGE,
  DOCUMENT_TYPE_LABEL,
  DOCUMENT_TYPE_ICON,
  effectiveStatus,
  formatDate,
  formatLei,
  formatFileSize,
  type DocumentType,
  type DocumentStatus,
} from "@/lib/documents";

export type DocumentRow = {
  id: string;
  title: string;
  lead_id: string | null;
  type: DocumentType;
  status: DocumentStatus;
  value_total: number | null;
  signed_date: string | null;
  expiry_date: string | null;
  file_path: string | null;
  file_name: string | null;
  file_size: number | null;
  owner_id: string | null;
  notes: string | null;
  created_at: string;
  owner: Owner | null;
  lead: { id: string; name: string } | null;
};

type LeadOption = { id: string; name: string };

type DocForm = {
  id?: string;
  title: string;
  lead_id: string;
  type: DocumentType;
  status: DocumentStatus;
  value_total: string;
  signed_date: string;
  expiry_date: string;
  owner_id: string;
  notes: string;
};

const CONFIRM_WORD = "STERGE";
const BUCKET = "documents";

function emptyForm(owners: Owner[]): DocForm {
  return {
    title: "",
    lead_id: "",
    type: "contract",
    status: "draft",
    value_total: "",
    signed_date: "",
    expiry_date: "",
    owner_id: owners[0]?.id ?? "",
    notes: "",
  };
}

export default function DocumentsBoard({
  initialDocuments,
  leads,
  owners,
  canEdit,
  canDelete,
}: {
  initialDocuments: DocumentRow[];
  leads: LeadOption[];
  owners: Owner[];
  canEdit: boolean;
  canDelete: boolean;
}) {
  const supabase = createClient();
  const [documents, setDocuments] = useState(initialDocuments);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<DocumentStatus | "toate">("toate");
  const [typeFilter, setTypeFilter] = useState<DocumentType | "toate">("toate");
  const [modal, setModal] = useState<null | { mode: "create" | "edit"; form: DocForm }>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmIds, setConfirmIds] = useState<string[] | null>(null);
  const [confirmStep, setConfirmStep] = useState<1 | 2>(1);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const [today] = useState(() => new Date());

  const filtered = useMemo(() => {
    return documents.filter((d) => {
      if (search && !d.title.toLowerCase().includes(search.toLowerCase()) && !(d.lead?.name.toLowerCase().includes(search.toLowerCase()))) return false;
      if (statusFilter !== "toate" && effectiveStatus(d.status, d.expiry_date, today) !== statusFilter) return false;
      if (typeFilter !== "toate" && d.type !== typeFilter) return false;
      return true;
    });
  }, [documents, search, statusFilter, typeFilter, today]);

  const kpis = useMemo(() => {
    const totalValue = documents
      .filter((d) => effectiveStatus(d.status, d.expiry_date, today) === "semnat")
      .reduce((sum, d) => sum + (d.value_total ?? 0), 0);
    const expiringSoon = documents.filter((d) => {
      if (effectiveStatus(d.status, d.expiry_date, today) !== "semnat" || !d.expiry_date) return false;
      const days = (new Date(d.expiry_date).getTime() - today.getTime()) / 86_400_000;
      return days >= 0 && days <= 30;
    }).length;
    const toSign = documents.filter((d) => d.status === "draft" || d.status === "trimis").length;
    return { total: documents.length, totalValue, expiringSoon, toSign };
  }, [documents, today]);

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
    setPendingFile(null);
    setModal({ mode: "create", form: emptyForm(owners) });
  }

  function openEdit(d: DocumentRow) {
    setError(null);
    setPendingFile(null);
    setModal({
      mode: "edit",
      form: {
        id: d.id,
        title: d.title,
        lead_id: d.lead_id ?? "",
        type: d.type,
        status: d.status,
        value_total: d.value_total != null ? String(d.value_total) : "",
        signed_date: d.signed_date ?? "",
        expiry_date: d.expiry_date ?? "",
        owner_id: d.owner_id ?? "",
        notes: d.notes ?? "",
      },
    });
  }

  async function uploadFile(documentId: string, file: File) {
    const path = `${documentId}/${Date.now()}-${file.name}`;
    const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
    if (uploadErr) throw uploadErr;
    return { path, name: file.name, size: file.size };
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!modal) return;
    const { form, mode } = modal;
    if (!form.title.trim()) {
      setError("Titlul e obligatoriu.");
      return;
    }
    setSaving(true);
    setError(null);

    const payload = {
      title: form.title.trim(),
      lead_id: form.lead_id || null,
      type: form.type,
      status: form.status,
      value_total: form.value_total ? Number(form.value_total) : null,
      signed_date: form.signed_date || null,
      expiry_date: form.expiry_date || null,
      owner_id: form.owner_id || null,
      notes: form.notes.trim() || null,
    };

    try {
      if (mode === "create") {
        const { data, error: err } = await supabase
          .from("documents")
          .insert(payload)
          .select("*, owner:profiles(id, full_name, initials), lead:leads(id, name)")
          .single();
        if (err) throw err;
        let row = data as DocumentRow;
        if (pendingFile) {
          const uploaded = await uploadFile(row.id, pendingFile);
          const { data: updated, error: updErr } = await supabase
            .from("documents")
            .update({ file_path: uploaded.path, file_name: uploaded.name, file_size: uploaded.size })
            .eq("id", row.id)
            .select("*, owner:profiles(id, full_name, initials), lead:leads(id, name)")
            .single();
          if (updErr) throw updErr;
          row = updated as DocumentRow;
        }
        setDocuments((prev) => [row, ...prev]);
      } else {
        let fileFields: { file_path?: string; file_name?: string; file_size?: number } = {};
        if (pendingFile) {
          const existing = documents.find((d) => d.id === form.id);
          if (existing?.file_path) {
            await supabase.storage.from(BUCKET).remove([existing.file_path]);
          }
          const uploaded = await uploadFile(form.id!, pendingFile);
          fileFields = { file_path: uploaded.path, file_name: uploaded.name, file_size: uploaded.size };
        }
        const { data, error: err } = await supabase
          .from("documents")
          .update({ ...payload, ...fileFields })
          .eq("id", form.id!)
          .select("*, owner:profiles(id, full_name, initials), lead:leads(id, name)")
          .single();
        if (err) throw err;
        setDocuments((prev) => prev.map((d) => (d.id === form.id ? (data as DocumentRow) : d)));
      }
      setModal(null);
      setPendingFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "A apărut o eroare.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDownload(d: DocumentRow) {
    if (!d.file_path) return;
    setDownloadingId(d.id);
    const { data, error: err } = await supabase.storage.from(BUCKET).createSignedUrl(d.file_path, 60);
    setDownloadingId(null);
    if (err || !data) return;
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
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
    const targets = documents.filter((d) => confirmIds.includes(d.id));
    const filePaths = targets.map((d) => d.file_path).filter((p): p is string => !!p);
    if (filePaths.length) {
      await supabase.storage.from(BUCKET).remove(filePaths);
    }
    const { error: err } = await supabase.from("documents").delete().in("id", confirmIds);
    setDeleting(false);
    if (err) {
      setDeleteError(err.message);
      return;
    }
    const idSet = new Set(confirmIds);
    setDocuments((prev) => prev.filter((d) => !idSet.has(d.id)));
    setSelected((prev) => {
      const next = new Set(prev);
      confirmIds.forEach((id) => next.delete(id));
      return next;
    });
    closeConfirm();
  }

  const confirmTargets = confirmIds ? documents.filter((d) => confirmIds.includes(d.id)) : [];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Documente &amp; Contracte</h1>
          <p>{documents.length} documente · contracte, oferte și anexe legate de clienți.</p>
        </div>
        {canEdit && (
          <button className="btn primary" onClick={openCreate}>+ Document nou</button>
        )}
      </div>

      <div className="grid g-4" style={{ marginBottom: 18 }}>
        <div className="card kpi">
          <div className="label">Total documente</div>
          <div className="value">{kpis.total}</div>
          <div className="delta up">contracte, oferte, anexe</div>
        </div>
        <div className="card kpi">
          <div className="label">Valoare contracte semnate</div>
          <div className="value" style={{ fontSize: 20 }}>{formatLei(kpis.totalValue)}</div>
          <div className="delta up">status „semnat”, neexpirate</div>
        </div>
        <div className="card kpi">
          <div className="label">Expiră în 30 zile</div>
          <div className="value">{kpis.expiringSoon}</div>
          <div className="delta down">necesită reînnoire</div>
        </div>
        <div className="card kpi">
          <div className="label">De semnat</div>
          <div className="value">{kpis.toSign}</div>
          <div className="delta up">draft + trimise</div>
        </div>
      </div>

      {canDelete && selected.size > 0 && (
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
            placeholder="Caută document sau client…"
            style={{ background: "transparent", border: "none", outline: "none", width: "100%", color: "var(--text)" }}
          />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as DocumentStatus | "toate")} style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px", fontSize: 12 }}>
          <option value="toate">Status: Toate</option>
          {DOCUMENT_STATUSES.map((s) => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as DocumentType | "toate")} style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px", fontSize: 12 }}>
          <option value="toate">Tip: Toate</option>
          {(Object.keys(DOCUMENT_TYPE_LABEL) as DocumentType[]).map((t) => (
            <option key={t} value={t}>{DOCUMENT_TYPE_LABEL[t]}</option>
          ))}
        </select>
        <span className="tag" style={{ marginLeft: "auto" }}>{filtered.length} rezultate</span>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table className="table">
          <thead>
            <tr>
              {canDelete && <th style={{ width: 34 }} />}
              <th>Document</th>
              <th>Client</th>
              <th>Status</th>
              <th>Valoare</th>
              <th>Expiră</th>
              <th>Responsabil</th>
              <th>Fișier</th>
              {canEdit && <th style={{ width: 44 }} />}
            </tr>
          </thead>
          <tbody>
            {filtered.map((d) => {
              const status = effectiveStatus(d.status, d.expiry_date, today);
              return (
                <tr key={d.id}>
                  {canDelete && (
                    <td>
                      <input type="checkbox" checked={selected.has(d.id)} onChange={() => toggleSelected(d.id)} aria-label={`Selectează ${d.title}`} />
                    </td>
                  )}
                  <td>
                    <div className="person">
                      <div className="p-avatar" style={{ fontSize: 15 }}>{DOCUMENT_TYPE_ICON[d.type]}</div>
                      <div>
                        <div className="p-name">{d.title}</div>
                        <div className="p-sub">{DOCUMENT_TYPE_LABEL[d.type]}</div>
                      </div>
                    </div>
                  </td>
                  <td>{d.lead ? <span className="tag">{d.lead.name}</span> : <span className="faint">—</span>}</td>
                  <td><span className={`badge ${DOCUMENT_STATUS_BADGE[status]}`}>{DOCUMENT_STATUS_LABEL[status]}</span></td>
                  <td className="mono">{d.value_total != null ? formatLei(d.value_total) : <span className="faint">—</span>}</td>
                  <td className="faint">{d.expiry_date ? formatDate(d.expiry_date) : "—"}</td>
                  <td>
                    {d.owner ? (
                      <div className="p-avatar" style={{ width: 26, height: 26, fontSize: 10 }}>{d.owner.initials}</div>
                    ) : (
                      <span className="faint">—</span>
                    )}
                  </td>
                  <td>
                    {d.file_path ? (
                      <button type="button" className="btn sm ghost" onClick={() => handleDownload(d)} disabled={downloadingId === d.id}>
                        {downloadingId === d.id ? "…" : "Descarcă"}
                      </button>
                    ) : (
                      <span className="faint" style={{ fontSize: 11.5 }}>fără fișier</span>
                    )}
                  </td>
                  {canEdit && (
                    <td>
                      <button type="button" className="icon-btn" style={{ width: 28, height: 28 }} title="Editează" onClick={() => openEdit(d)}>
                        ✎
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={canDelete ? (canEdit ? 9 : 8) : canEdit ? 8 : 7}>
                  <div className="empty-note">Niciun document nu corespunde filtrelor alese.</div>
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
              <h3>{modal.mode === "create" ? "Document nou" : "Editează document"}</h3>
              <button className="modal-close" onClick={() => setModal(null)}>✕</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="field">
                <label>Titlu</label>
                <input value={modal.form.title} onChange={(e) => setModal({ ...modal, form: { ...modal.form, title: e.target.value } })} />
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
                  <label>Tip</label>
                  <select value={modal.form.type} onChange={(e) => setModal({ ...modal, form: { ...modal.form, type: e.target.value as DocumentType } })}>
                    {(Object.keys(DOCUMENT_TYPE_LABEL) as DocumentType[]).map((t) => (
                      <option key={t} value={t}>{DOCUMENT_TYPE_LABEL[t]}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Status</label>
                  <select value={modal.form.status} onChange={(e) => setModal({ ...modal, form: { ...modal.form, status: e.target.value as DocumentStatus } })}>
                    {DOCUMENT_STATUSES.map((s) => (
                      <option key={s.key} value={s.key}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid g-2">
                <div className="field">
                  <label>Valoare totală (opțional)</label>
                  <input type="number" min="0" step="0.01" value={modal.form.value_total} onChange={(e) => setModal({ ...modal, form: { ...modal.form, value_total: e.target.value } })} />
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
              <div className="grid g-2">
                <div className="field">
                  <label>Dată semnare (opțional)</label>
                  <input type="date" value={modal.form.signed_date} onChange={(e) => setModal({ ...modal, form: { ...modal.form, signed_date: e.target.value } })} />
                </div>
                <div className="field">
                  <label>Expiră la (opțional)</label>
                  <input type="date" value={modal.form.expiry_date} onChange={(e) => setModal({ ...modal, form: { ...modal.form, expiry_date: e.target.value } })} />
                </div>
              </div>
              <div className="field">
                <label>Fișier {modal.mode === "edit" ? "(înlocuiește fișierul existent)" : "(opțional)"}</label>
                <input type="file" onChange={(e) => setPendingFile(e.target.files?.[0] ?? null)} />
                {modal.mode === "edit" && documents.find((d) => d.id === modal.form.id)?.file_name && !pendingFile && (
                  <div className="faint" style={{ fontSize: 11.5, marginTop: 6 }}>
                    Fișier curent: {documents.find((d) => d.id === modal.form.id)?.file_name}
                    {(() => {
                      const size = documents.find((d) => d.id === modal.form.id)?.file_size;
                      return size ? ` (${formatFileSize(size)})` : "";
                    })()}
                  </div>
                )}
              </div>
              <div className="field">
                <label>Notițe</label>
                <textarea rows={2} value={modal.form.notes} onChange={(e) => setModal({ ...modal, form: { ...modal.form, notes: e.target.value } })} />
              </div>

              {error && <div className="field-error">{error}</div>}

              <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
                {modal.mode === "edit" && canDelete && (
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
              <h3>Șterge {confirmIds.length > 1 ? `${confirmIds.length} documente` : "document"}</h3>
              <button className="modal-close" onClick={closeConfirm}>✕</button>
            </div>

            {confirmStep === 1 ? (
              <>
                <p style={{ marginBottom: 4 }}>
                  Sigur vrei să ștergi {confirmIds.length > 1 ? "aceste documente" : "acest document"}?
                </p>
                <div className="list" style={{ marginBottom: 14, maxHeight: 160, overflowY: "auto" }}>
                  {confirmTargets.map((d) => (
                    <div key={d.id} className="list-row" style={{ padding: "8px 4px" }}>
                      <span className="p-name" style={{ fontSize: 13 }}>{d.title}</span>
                    </div>
                  ))}
                </div>
                <div className="field-error" style={{ marginBottom: 14 }}>
                  Acțiunea este ireversibilă — fișierul atașat se șterge definitiv din storage.
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
                  {confirmIds.length > 1 ? ` cele ${confirmIds.length} documente` : " acest document"}.
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

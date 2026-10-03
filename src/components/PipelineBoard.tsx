"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import InfoTip from "@/components/InfoTip";
import { STAGES, STAGE_LABEL, LEAD_STATUSES, STATUS_BADGE, STATUS_LABEL, daysSince, formatLei, type LeadStage, type LeadStatus } from "@/lib/pipeline";
import { OWNER_SELECT } from "@/lib/selects";
import { useRealtimeRows } from "@/lib/useRealtimeRows";

export type Owner = { id: string; full_name: string; initials: string };
export type LeadRow = {
  id: string;
  name: string;
  source: string;
  stage: LeadStage;
  value_monthly: number;
  owner_id: string | null;
  notes: string | null;
  created_at: string;
  last_activity_at: string;
  clips_count: number | null;
  editor_pay: number;
  editor_id: string | null;
  project_start: string | null;
  status: LeadStatus;
  lost_reason: string | null;
  package: string | null;
  owner: Owner | null;
};

type FormState = {
  id?: string;
  name: string;
  source: string;
  stage: LeadStage;
  value_monthly: string;
  owner_id: string;
  notes: string;
  status: LeadStatus;
  lost_reason: string;
  package: string;
  clips_count: string;
  editor_pay: string;
  editor_id: string;
  project_start: string;
  created_at?: string;
};

// today as yyyy-mm-dd in the user's own time zone
const todayLocal = () => new Date().toLocaleDateString("sv-SE");

const EMPTY_FORM: FormState = {
  name: "",
  source: "Manual",
  stage: "nou",
  value_monthly: "0",
  owner_id: "",
  notes: "",
  status: "pending",
  lost_reason: "",
  package: "",
  clips_count: "",
  editor_pay: "",
  editor_id: "",
  project_start: "",
};

export default function PipelineBoard({
  initialLeads,
  owners,
  canDelete,
  editors,
  currentUserId,
  startAsClient,
  canExport,
}: {
  initialLeads: LeadRow[];
  owners: Owner[];
  canDelete: boolean;
  editors: { id: string; full_name: string }[];
  currentUserId: string;
  canExport?: boolean; // closers cannot export the pipeline
  startAsClient?: boolean; // opened from "+ Client nou" in Clienți: the form starts as a confirmed client
}) {
  const [allLeads, setLeads] = useState(initialLeads);
  useRealtimeRows({ table: "leads", select: OWNER_SELECT, setRows: setLeads });
  // The pipeline only holds leads that came from Prospecți or from a booking; clients added by hand live in Clienți.
  const leads = useMemo(() => allLeads.filter((l) => l.source !== "Manual"), [allLeads]);
  const [modal, setModal] = useState<null | { mode: "create" | "edit"; form: FormState }>(() =>
    startAsClient
      ? {
          mode: "create",
          form: { ...EMPTY_FORM, stage: "confirmat", status: "confirmat", owner_id: currentUserId, project_start: todayLocal(), created_at: new Date().toISOString() },
        }
      : null,
  );
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const supabase = createClient();
  const router = useRouter();

  const kpis = useMemo(() => {
    // Day-granularity KPIs — a few ms of drift across renders doesn't change
    // the counts, so Date.now() here is fine despite the purity lint rule.
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now();
    const newLast7d = leads.filter((l) => now - new Date(l.created_at).getTime() < 7 * 86_400_000).length;
    const pipelineValue = leads
      .filter((l) => l.status === "pending" || (l.stage !== "confirmat" && l.status !== "pierdut"))
      .reduce((sum, l) => sum + Number(l.value_monthly), 0);
    const reachedConfirmed = leads.filter((l) => l.stage === "confirmat" && l.status === "confirmat").length;
    const conversionRate = leads.length ? Math.round((reachedConfirmed / leads.length) * 100) : 0;
    const overdue = leads.filter(
      (l) => ["nou", "discutie"].includes(l.stage) && daysSince(l.last_activity_at) > 3,
    ).length;
    return { newLast7d, pipelineValue, conversionRate, overdue };
  }, [leads]);

  function openEdit(lead: LeadRow) {
    setFormError(null);
    setModal({
      mode: "edit",
      form: {
        id: lead.id,
        name: lead.name,
        source: lead.source,
        stage: lead.stage,
        value_monthly: String(lead.value_monthly),
        owner_id: lead.owner_id ?? "",
        notes: lead.notes ?? "",
        status: lead.status,
        lost_reason: lead.lost_reason ?? "",
        package: lead.package ?? "",
        clips_count: lead.clips_count == null ? "" : String(lead.clips_count),
        editor_pay: lead.editor_pay ? String(lead.editor_pay) : "",
        editor_id: lead.editor_id ?? "",
        project_start: lead.project_start ?? "",
        created_at: lead.created_at,
      },
    });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!modal) return;
    const { form, mode } = modal;
    if (!form.name.trim()) {
      setFormError("Numele clientului e obligatoriu.");
      return;
    }
    const dupName = (n: string) => n.trim().replace(/\s+/g, " ").toLowerCase();
    if (mode === "create" && allLeads.some((l) => l.source === "Manual" && dupName(l.name) === dupName(form.name))) {
      setFormError("Există deja un client adăugat manual cu acest nume.");
      return;
    }
    const inStatus = form.stage === "confirmat";
    if (inStatus && form.status === "pierdut" && !form.lost_reason.trim()) {
      setFormError("Scrie motivul pierderii (de ex: n-are buget, nu ne potrivim).");
      return;
    }
    setSaving(true);
    setFormError(null);

    const payload = {
      name: form.name.trim(),
      source: form.source.trim() || "Site",
      stage: form.stage,
      value_monthly: Number(form.value_monthly) || 0,
      owner_id: form.owner_id || null,
      notes: form.notes.trim() || null,
      status: inStatus ? form.status : ("pending" as LeadStatus),
      lost_reason: inStatus && form.status === "pierdut" ? form.lost_reason.trim() : null,
      package: form.package.trim() || null,
      ...(canDelete
        ? {
            clips_count: form.clips_count.trim() === "" ? null : Math.max(0, Math.round(Number(form.clips_count)) || 0),
            editor_pay: Math.max(0, Number(form.editor_pay.replace(",", ".")) || 0),
            editor_id: form.editor_id || null,
            project_start: form.project_start || (mode === "create" ? todayLocal() : null),
          }
        : {}),
      last_activity_at: new Date().toISOString(),
    };

    if (mode === "create") {
      const { data, error } = await supabase
        .from("leads")
        .insert(payload)
        .select(OWNER_SELECT)
        .single();
      setSaving(false);
      if (error) {
        setFormError(error.code === "23505" ? "Există deja un client adăugat manual cu acest nume." : error.message);
        return;
      }
      setLeads((prev) => [data as LeadRow, ...prev]);
      setModal(null);
      if (payload.source === "Manual") router.push("/clienti"); // manual clients live in Clienți, not in the pipeline
    } else {
      const { data, error } = await supabase
        .from("leads")
        .update(payload)
        .eq("id", form.id!)
        .select(OWNER_SELECT)
        .single();
      setSaving(false);
      if (error) {
        setFormError(error.message);
        return;
      }
      setLeads((prev) => prev.map((l) => (l.id === form.id ? (data as LeadRow) : l)));
      setModal(null);
    }
  }

  async function handleDelete() {
    if (!modal?.form.id) return;
    if (!window.confirm("Ștergi definitiv acest lead/client din pipeline?")) return;
    setSaving(true);
    const { error } = await supabase.from("leads").delete().eq("id", modal.form.id);
    setSaving(false);
    if (error) {
      setFormError(error.message);
      return;
    }
    setLeads((prev) => prev.filter((l) => l.id !== modal.form.id));
    setModal(null);
  }

  function exportCsv() {
    const header = ["Nume", "Sursă", "Etapă / status", "Valoare lunară (lei)", "Responsabil", "Creat", "Ultima activitate"];
    const rows = leads.map((l) => [
      l.name,
      l.source,
      l.stage === "confirmat" ? `Status: ${STATUS_LABEL[l.status]}` : STAGE_LABEL[l.stage],
      String(l.value_monthly),
      l.owner?.full_name ?? "",
      new Date(l.created_at).toLocaleDateString("ro-RO"),
      new Date(l.last_activity_at).toLocaleDateString("ro-RO"),
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pipeline-creative-c-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Pipeline & Dashboard</h1>
          <p>Lead-urile: Nou → În discuție (când e setat meeting-ul) → Status (Pending / Confirmat / Respins). Lead-urile vin din Prospecți (butonul &bdquo;Lead&rdquo;).</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {canExport && <button className="btn ghost" onClick={exportCsv}>Exportă CSV</button>}
        </div>
      </div>

      <div className="grid g-4" style={{ marginBottom: 24 }}>
        <div className="card kpi">
          <div className="label">
            <span className="title-row">Lead-uri noi (7 zile) <InfoTip text="Câte lead-uri, indiferent de etapă, au fost create în ultimele 7 zile. Se actualizează automat la fiecare lead adăugat." /></span>
          </div>
          <div className="value">{kpis.newLast7d}</div>
          <div className="delta up">din {leads.length} lead-uri în total</div>
        </div>
        <div className="card kpi">
          <div className="label">
            <span className="title-row">Rată de conversie <InfoTip text="Procentul de lead-uri cu status Confirmat, din totalul lead-urilor create vreodată." /></span>
          </div>
          <div className="value">{kpis.conversionRate}%</div>
          <div className="delta up">calculată automat din pipeline</div>
        </div>
        <div className="card kpi">
          <div className="label">
            <span className="title-row">Valoare pipeline activ <InfoTip text="Suma valorilor lunare ale lead-urilor încă în joc (fără cele Respinse sau deja confirmate). Editează valoarea oricărui card ca să vezi cum se schimbă suma." align="right" /></span>
          </div>
          <div className="value mono">{formatLei(kpis.pipelineValue)}</div>
          <div className="delta up">editabil pe fiecare card</div>
        </div>
        <div className="card kpi">
          <div className="label">
            <span className="title-row">Follow-up-uri întârziate <InfoTip text="Lead-uri în etapa Nou sau În discuție, fără nicio activitate de peste 3 zile." align="right" /></span>
          </div>
          <div className="value" style={{ color: kpis.overdue ? "var(--danger)" : undefined }}>{kpis.overdue}</div>
          <div className="delta down">necesită acțiune azi</div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          <h3>Pipeline lead-uri</h3>
          <span className="hint">Click pe un card = editează etapa, statusul, valoarea sau responsabilul</span>
        </div>

        <div className="kanban">
          {STAGES.map((stage) => {
            const items = leads.filter((l) => l.stage === stage.key);
            return (
              <div className="kanban-col" key={stage.key}>
                <div className="kanban-col-head">
                  <span className="title-row">
                    <h4>{stage.label}</h4>
                    <InfoTip text={stage.help} />
                  </span>
                  <span className="kanban-count">{items.length}</span>
                </div>
                {items.map((lead) => (
                  <button className="kcard" key={lead.id} onClick={() => openEdit(lead)}>
                    <div className="title">{lead.name}</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {lead.stage === "confirmat" ? (
                        <span className={`badge ${STATUS_BADGE[lead.status]}`}>{STATUS_LABEL[lead.status]}</span>
                      ) : (
                        <span className="badge gray">{lead.source}</span>
                      )}
                      {lead.value_monthly > 0 && <span className="tag mono">{formatLei(lead.value_monthly)}</span>}
                    </div>
                    {lead.status === "pierdut" && lead.lost_reason && <div className="faint" style={{ fontSize: 11.5, marginTop: 4 }}>Motiv: {lead.lost_reason}</div>}
                    <div className="meta">
                      <span className="faint">{new Date(lead.created_at).toLocaleString("ro-RO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                      {lead.owner && (
                        <div className="p-avatar" style={{ width: 22, height: 22, fontSize: 10 }}>
                          {lead.owner.initials}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
                {items.length === 0 && <div className="empty-note">Niciun lead aici</div>}
              </div>
            );
          })}
        </div>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" style={{ maxHeight: "92vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{modal.mode === "create" ? "Lead / client nou" : "Editează lead"}</h3>
              <button className="modal-close" onClick={() => setModal(null)}>✕</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="field">
                <label>Nume client</label>
                <input value={modal.form.name} onChange={(e) => setModal({ ...modal, form: { ...modal.form, name: e.target.value } })} placeholder="ex: Bella Cosmetics SRL" />
              </div>
              {canDelete && (
                <>
                  <div className="grid g-2">
                    <div className="field">
                      <label>Număr clipuri</label>
                      <input inputMode="numeric" value={modal.form.clips_count} onChange={(e) => setModal({ ...modal, form: { ...modal.form, clips_count: e.target.value } })} placeholder="ex: 20" />
                    </div>
                    <div className="field">
                      <label>Plată editor (lei)</label>
                      <input inputMode="decimal" value={modal.form.editor_pay} onChange={(e) => setModal({ ...modal, form: { ...modal.form, editor_pay: e.target.value } })} placeholder="ex: 800" />
                    </div>
                  </div>
                  <div className="grid g-2">
                    <div className="field">
                      <label>Editor</label>
                      <select value={modal.form.editor_id} onChange={(e) => setModal({ ...modal, form: { ...modal.form, editor_id: e.target.value } })}>
                        <option value="">— fără editor —</option>
                        {editors.map((ed) => <option key={ed.id} value={ed.id}>{ed.full_name}</option>)}
                      </select>
                    </div>
                    <div className="field">
                      <label>Data începere proiect</label>
                      <input type="date" value={modal.form.project_start} onChange={(e) => setModal({ ...modal, form: { ...modal.form, project_start: e.target.value } })} />
                    </div>
                  </div>
                </>
              )}
              <div className="grid g-2">
                <div className="field">
                  <label>Valoare lunară (lei)</label>
                  <input type="number" min="0" step="50" value={modal.form.value_monthly} onChange={(e) => setModal({ ...modal, form: { ...modal.form, value_monthly: e.target.value } })} />
                </div>
                <div className="field">
                  <label>Pachet</label>
                  <input value={modal.form.package} onChange={(e) => setModal({ ...modal, form: { ...modal.form, package: e.target.value } })} placeholder="ex: 20 clipuri / lună" />
                </div>
              </div>

              {/* Only when editing an existing lead: where it is in the pipeline, its status and who handles it */}
              {modal.mode === "edit" && (
                <>
                  <div className="grid g-2">
                    <div className="field">
                      <label>Etapă</label>
                      <select value={modal.form.stage} onChange={(e) => setModal({ ...modal, form: { ...modal.form, stage: e.target.value as LeadStage } })}>
                        {STAGES.map((s) => (
                          <option key={s.key} value={s.key}>{s.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label>Responsabil</label>
                      <select value={modal.form.owner_id} onChange={(e) => setModal({ ...modal, form: { ...modal.form, owner_id: e.target.value } })}>
                        <option value="">— fără responsabil —</option>
                        {owners.map((o) => (
                          <option key={o.id} value={o.id}>{o.full_name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {modal.form.stage === "confirmat" && (
                    <div className="field">
                      <label>Status</label>
                      <div style={{ display: "flex", gap: 8 }}>
                        {LEAD_STATUSES.map((st) => (
                          <button
                            key={st.key}
                            type="button"
                            className={`btn sm ${modal.form.status === st.key ? "primary" : "ghost"}`}
                            onClick={() => setModal({ ...modal, form: { ...modal.form, status: st.key } })}
                          >
                            {st.label}
                          </button>
                        ))}
                      </div>
                      {modal.form.status === "pierdut" && (
                        <textarea
                          style={{ marginTop: 8 }}
                          rows={2}
                          placeholder="Motivul pierderii — scrie orice (ex: n-are buget, nu ne potrivim)"
                          value={modal.form.lost_reason}
                          onChange={(e) => setModal({ ...modal, form: { ...modal.form, lost_reason: e.target.value } })}
                        />
                      )}
                    </div>
                  )}
                  <div className="faint" style={{ fontSize: 12, marginBottom: 10 }}>
                    Lead introdus: {new Date(modal.form.created_at ?? 0).toLocaleString("ro-RO", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </div>
                </>
              )}
              <div className="field">
                <label>Notițe</label>
                <textarea rows={2} value={modal.form.notes} onChange={(e) => setModal({ ...modal, form: { ...modal.form, notes: e.target.value } })} />
              </div>

              {formError && <div className="field-error">{formError}</div>}

              <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
                {modal.mode === "edit" && canDelete && (
                  <button type="button" className="btn danger" onClick={handleDelete} disabled={saving}>
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
    </>
  );
}

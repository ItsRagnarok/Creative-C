"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import InfoTip from "@/components/InfoTip";
import { STAGES, STAGE_LABEL, daysSince, timeAgo, formatLei, type LeadStage } from "@/lib/pipeline";

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
};

const EMPTY_FORM: FormState = {
  name: "",
  source: "Site",
  stage: "nou",
  value_monthly: "0",
  owner_id: "",
  notes: "",
};

export default function PipelineBoard({
  initialLeads,
  owners,
  canDelete,
}: {
  initialLeads: LeadRow[];
  owners: Owner[];
  canDelete: boolean;
}) {
  const [leads, setLeads] = useState(initialLeads);
  const [modal, setModal] = useState<null | { mode: "create" | "edit"; form: FormState }>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const supabase = createClient();

  const kpis = useMemo(() => {
    // Day-granularity KPIs — a few ms of drift across renders doesn't change
    // the counts, so Date.now() here is fine despite the purity lint rule.
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now();
    const newLast7d = leads.filter((l) => now - new Date(l.created_at).getTime() < 7 * 86_400_000).length;
    const pipelineValue = leads
      .filter((l) => l.stage !== "finalizat")
      .reduce((sum, l) => sum + Number(l.value_monthly), 0);
    const reachedConfirmed = leads.filter((l) => ["confirmat", "lucru", "finalizat"].includes(l.stage)).length;
    const conversionRate = leads.length ? Math.round((reachedConfirmed / leads.length) * 100) : 0;
    const overdue = leads.filter(
      (l) => ["nou", "discutie"].includes(l.stage) && daysSince(l.last_activity_at) > 3,
    ).length;
    return { newLast7d, pipelineValue, conversionRate, overdue };
  }, [leads]);

  function openCreate() {
    setFormError(null);
    setModal({ mode: "create", form: { ...EMPTY_FORM, owner_id: owners[0]?.id ?? "" } });
  }

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
    setSaving(true);
    setFormError(null);

    const payload = {
      name: form.name.trim(),
      source: form.source.trim() || "Site",
      stage: form.stage,
      value_monthly: Number(form.value_monthly) || 0,
      owner_id: form.owner_id || null,
      notes: form.notes.trim() || null,
      last_activity_at: new Date().toISOString(),
    };

    if (mode === "create") {
      const { data, error } = await supabase
        .from("leads")
        .insert(payload)
        .select("*, owner:profiles(id, full_name, initials)")
        .single();
      setSaving(false);
      if (error) {
        setFormError(error.message);
        return;
      }
      setLeads((prev) => [data as LeadRow, ...prev]);
      setModal(null);
    } else {
      const { data, error } = await supabase
        .from("leads")
        .update(payload)
        .eq("id", form.id!)
        .select("*, owner:profiles(id, full_name, initials)")
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
    const header = ["Nume", "Sursă", "Etapă", "Valoare lunară (lei)", "Responsabil", "Creat", "Ultima activitate"];
    const rows = leads.map((l) => [
      l.name,
      l.source,
      STAGE_LABEL[l.stage],
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
          <p>Toate lead-urile active, de la primul contact până la proiect finalizat.</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn ghost" onClick={exportCsv}>Exportă CSV</button>
          <button className="btn primary" onClick={openCreate}>+ Lead manual</button>
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
            <span className="title-row">Rată de conversie <InfoTip text="Procentul de lead-uri care au ajuns cel puțin la etapa Confirmat, din totalul lead-urilor create vreodată." /></span>
          </div>
          <div className="value">{kpis.conversionRate}%</div>
          <div className="delta up">calculată automat din pipeline</div>
        </div>
        <div className="card kpi">
          <div className="label">
            <span className="title-row">Valoare pipeline activ <InfoTip text="Suma valorilor lunare ale tuturor lead-urilor care nu sunt Finalizate. Editează valoarea oricărui card ca să vezi cum se schimbă suma." align="right" /></span>
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
          <span className="hint">Click pe un card = editează stadiul, valoarea sau responsabilul</span>
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
                      <span className="badge gray">{lead.source}</span>
                      {lead.value_monthly > 0 && <span className="tag mono">{formatLei(lead.value_monthly)}</span>}
                    </div>
                    <div className="meta">
                      <span className="faint">{timeAgo(lead.last_activity_at)}</span>
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
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{modal.mode === "create" ? "Lead / client nou" : "Editează lead"}</h3>
              <button className="modal-close" onClick={() => setModal(null)}>✕</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="field">
                <label>Nume client</label>
                <input
                  value={modal.form.name}
                  onChange={(e) => setModal({ ...modal, form: { ...modal.form, name: e.target.value } })}
                  placeholder="ex: Bella Cosmetics SRL"
                />
              </div>
              <div className="grid g-2">
                <div className="field">
                  <label>Sursă</label>
                  <input
                    value={modal.form.source}
                    onChange={(e) => setModal({ ...modal, form: { ...modal.form, source: e.target.value } })}
                    placeholder="Site, Recomandare, Social media…"
                  />
                </div>
                <div className="field">
                  <label>Etapă</label>
                  <select
                    value={modal.form.stage}
                    onChange={(e) => setModal({ ...modal, form: { ...modal.form, stage: e.target.value as LeadStage } })}
                  >
                    {STAGES.map((s) => (
                      <option key={s.key} value={s.key}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid g-2">
                <div className="field">
                  <label>Valoare lunară (lei)</label>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    value={modal.form.value_monthly}
                    onChange={(e) => setModal({ ...modal, form: { ...modal.form, value_monthly: e.target.value } })}
                  />
                </div>
                <div className="field">
                  <label>Responsabil</label>
                  <select
                    value={modal.form.owner_id}
                    onChange={(e) => setModal({ ...modal, form: { ...modal.form, owner_id: e.target.value } })}
                  >
                    <option value="">— fără responsabil —</option>
                    {owners.map((o) => (
                      <option key={o.id} value={o.id}>{o.full_name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="field">
                <label>Notițe</label>
                <textarea
                  rows={3}
                  value={modal.form.notes}
                  onChange={(e) => setModal({ ...modal, form: { ...modal.form, notes: e.target.value } })}
                />
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

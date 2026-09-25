"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { STAGES, STAGE_LABEL, STAGE_BADGE, formatLei, monthYear, type LeadStage } from "@/lib/pipeline";
import type { LeadRow, Owner } from "@/components/PipelineBoard";

type FormState = {
  name: string;
  source: string;
  stage: LeadStage;
  value_monthly: string;
  owner_id: string;
  notes: string;
};

export default function ClientDetail({
  lead,
  owners,
  canEdit,
  canDelete,
}: {
  lead: LeadRow;
  owners: Owner[];
  canEdit: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [current, setCurrent] = useState(lead);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({
    name: lead.name,
    source: lead.source,
    stage: lead.stage,
    value_monthly: String(lead.value_monthly),
    owner_id: lead.owner_id ?? "",
    notes: lead.notes ?? "",
  });

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Numele clientului e obligatoriu.");
      return;
    }
    setSaving(true);
    setError(null);
    const { data, error: saveError } = await supabase
      .from("leads")
      .update({
        name: form.name.trim(),
        source: form.source.trim() || "Site",
        stage: form.stage,
        value_monthly: Number(form.value_monthly) || 0,
        owner_id: form.owner_id || null,
        notes: form.notes.trim() || null,
        last_activity_at: new Date().toISOString(),
      })
      .eq("id", lead.id)
      .select("*, owner:profiles(id, full_name, initials)")
      .single();
    setSaving(false);
    if (saveError) {
      setError(saveError.message);
      return;
    }
    setCurrent(data as LeadRow);
    setEditing(false);
  }

  async function handleDelete() {
    if (!window.confirm(`Ștergi definitiv „${current.name}” din pipeline?`)) return;
    setSaving(true);
    const { error: deleteError } = await supabase.from("leads").delete().eq("id", lead.id);
    setSaving(false);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    router.push("/clienti");
    router.refresh();
  }

  return (
    <>
      <Link href="/clienti" className="faint" style={{ fontSize: 12.5 }}>
        ← Înapoi la Clienți
      </Link>

      <div className="page-head" style={{ marginTop: 10 }}>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <div className="p-avatar" style={{ width: 52, height: 52, fontSize: 18, borderRadius: 14 }}>
            {current.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h1>{current.name}</h1>
            <p>
              client din {monthYear(current.created_at)} · sursă: <span className="tag">{current.source}</span>
              {current.owner && (
                <>
                  {" "}
                  · responsabil <b style={{ color: "var(--text)" }}>{current.owner.full_name}</b>
                </>
              )}
            </p>
          </div>
        </div>
        {canEdit && (
          <div style={{ display: "flex", gap: 10 }}>
            {canDelete && (
              <button className="btn danger" onClick={handleDelete} disabled={saving}>
                Șterge
              </button>
            )}
            <button className="btn primary" onClick={() => setEditing(true)}>
              Editează
            </button>
          </div>
        )}
      </div>

      <div className="grid g-4" style={{ marginBottom: 10 }}>
        <div className="card kpi">
          <div className="label">Status</div>
          <div className="value" style={{ fontSize: 18 }}>
            <span className={`badge ${STAGE_BADGE[current.stage]}`}>{STAGE_LABEL[current.stage]}</span>
          </div>
        </div>
        <div className="card kpi">
          <div className="label">Valoare lunară</div>
          <div className="value mono">{current.value_monthly > 0 ? formatLei(current.value_monthly) : "—"}</div>
        </div>
        <div className="card kpi">
          <div className="label">Client din</div>
          <div className="value" style={{ fontSize: 18 }}>{monthYear(current.created_at)}</div>
        </div>
        <div className="card kpi">
          <div className="label">Ultima activitate</div>
          <div className="value" style={{ fontSize: 18 }}>
            {new Date(current.last_activity_at).toLocaleDateString("ro-RO")}
          </div>
        </div>
      </div>

      <div className="tabs">
        <div className="tab active">Prezentare generală</div>
        <div className="nav-item disabled" style={{ display: "inline-flex", marginRight: 18 }}>Documente <span className="ext">curând</span></div>
        <div className="nav-item disabled" style={{ display: "inline-flex", marginRight: 18 }}>Facturi <span className="ext">curând</span></div>
        <div className="nav-item disabled" style={{ display: "inline-flex" }}>Proiecte <span className="ext">curând</span></div>
      </div>

      <div className="card">
        <div className="card-title"><h3>Notițe & preferințe</h3></div>
        <p style={{ fontSize: 13, color: "var(--text)" }}>
          {current.notes || <span className="faint">Nicio notiță încă — adaugă una din „Editează”.</span>}
        </p>
      </div>

      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Editează client</h3>
              <button className="modal-close" onClick={() => setEditing(false)}>✕</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="field">
                <label>Nume client</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="grid g-2">
                <div className="field">
                  <label>Sursă</label>
                  <input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} />
                </div>
                <div className="field">
                  <label>Etapă</label>
                  <select value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value as LeadStage })}>
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
                    value={form.value_monthly}
                    onChange={(e) => setForm({ ...form, value_monthly: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Responsabil</label>
                  <select value={form.owner_id} onChange={(e) => setForm({ ...form, owner_id: e.target.value })}>
                    <option value="">— fără responsabil —</option>
                    {owners.map((o) => (
                      <option key={o.id} value={o.id}>{o.full_name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="field">
                <label>Notițe</label>
                <textarea rows={4} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>

              {error && <div className="field-error">{error}</div>}

              <button type="submit" className="btn primary" style={{ width: "100%", justifyContent: "center" }} disabled={saving}>
                {saving ? "Se salvează…" : "Salvează"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { STAGES, STAGE_LABEL, STAGE_BADGE, formatLei, timeAgo, monthYear, type LeadStage } from "@/lib/pipeline";
import type { LeadRow } from "@/components/PipelineBoard";

const CONFIRM_WORD = "STERGE";

export default function ClientsTable({ initialLeads, canDelete }: { initialLeads: LeadRow[]; canDelete: boolean }) {
  const router = useRouter();
  const supabase = createClient();
  const [leads, setLeads] = useState(initialLeads);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<LeadStage | "toate">("toate");
  const [sourceFilter, setSourceFilter] = useState("toate");
  const [ownerFilter, setOwnerFilter] = useState("toate");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmIds, setConfirmIds] = useState<string[] | null>(null);
  const [confirmStep, setConfirmStep] = useState<1 | 2>(1);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const sources = useMemo(
    () => Array.from(new Set(leads.map((l) => l.source))).sort(),
    [leads],
  );
  const owners = useMemo(() => {
    const map = new Map<string, string>();
    leads.forEach((l) => {
      if (l.owner) map.set(l.owner.id, l.owner.full_name);
    });
    return Array.from(map.entries());
  }, [leads]);

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      if (search && !l.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (stageFilter !== "toate" && l.stage !== stageFilter) return false;
      if (sourceFilter !== "toate" && l.source !== sourceFilter) return false;
      if (ownerFilter !== "toate" && l.owner_id !== ownerFilter) return false;
      return true;
    });
  }, [leads, search, stageFilter, sourceFilter, ownerFilter]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((l) => selected.has(l.id));

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllFiltered() {
    setSelected((prev) => {
      if (allFilteredSelected) {
        const next = new Set(prev);
        filtered.forEach((l) => next.delete(l.id));
        return next;
      }
      const next = new Set(prev);
      filtered.forEach((l) => next.add(l.id));
      return next;
    });
  }

  function openConfirm(ids: string[]) {
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
    const { error } = await supabase.from("leads").delete().in("id", confirmIds);
    setDeleting(false);
    if (error) {
      setDeleteError(error.message);
      return;
    }
    const idSet = new Set(confirmIds);
    setLeads((prev) => prev.filter((l) => !idSet.has(l.id)));
    setSelected((prev) => {
      const next = new Set(prev);
      confirmIds.forEach((id) => next.delete(id));
      return next;
    });
    closeConfirm();
  }

  const confirmTargets = confirmIds ? leads.filter((l) => confirmIds.includes(l.id)) : [];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Clienți</h1>
          <p>{leads.length} clienți/lead-uri · istoric, sursă, status și valoare.</p>
        </div>
        <button className="btn primary" onClick={() => router.push("/dashboard")}>
          + Client nou (din Pipeline)
        </button>
      </div>

      {canDelete && selected.size > 0 && (
        <div className="card" style={{ marginBottom: 18, padding: "12px 18px", display: "flex", alignItems: "center", gap: 12 }}>
          <span className="tag">{selected.size} selectați</span>
          <button type="button" className="btn ghost sm" onClick={() => setSelected(new Set())}>Anulează selecția</button>
          <button
            type="button"
            className="btn danger sm"
            style={{ marginLeft: "auto" }}
            onClick={() => openConfirm(Array.from(selected))}
          >
            Șterge selectații
          </button>
        </div>
      )}

      <div className="card" style={{ marginBottom: 18, display: "flex", gap: 10, flexWrap: "wrap", padding: "14px 18px" }}>
        <div className="search" style={{ maxWidth: 260 }}>
          🔍
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Caută client…"
            style={{ background: "transparent", border: "none", outline: "none", width: "100%", color: "var(--text)" }}
          />
        </div>
        <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value as LeadStage | "toate")} style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px", fontSize: 12 }}>
          <option value="toate">Status: Toate</option>
          {STAGES.map((s) => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>
        <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px", fontSize: 12 }}>
          <option value="toate">Sursă: Toate</option>
          {sources.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)} style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px", fontSize: 12 }}>
          <option value="toate">Responsabil: Toți</option>
          {owners.map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </select>
        <span className="tag" style={{ marginLeft: "auto" }}>{filtered.length} rezultate</span>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table className="table">
          <thead>
            <tr>
              {canDelete && (
                <th style={{ width: 34 }}>
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={toggleAllFiltered}
                    aria-label="Selectează toți clienții afișați"
                  />
                </th>
              )}
              <th>Client</th>
              <th>Sursă</th>
              <th>Status</th>
              <th>Valoare/lună</th>
              <th>Responsabil</th>
              <th>Ultima activitate</th>
              {canDelete && <th style={{ width: 44 }} />}
            </tr>
          </thead>
          <tbody>
            {filtered.map((l) => (
              <tr key={l.id} className="row-link" onClick={() => router.push(`/clienti/${l.id}`)}>
                {canDelete && (
                  <td onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(l.id)}
                      onChange={() => toggleOne(l.id)}
                      aria-label={`Selectează ${l.name}`}
                    />
                  </td>
                )}
                <td>
                  <div className="person">
                    <div className="p-avatar">{l.name.slice(0, 2).toUpperCase()}</div>
                    <div>
                      <div className="p-name">{l.name}</div>
                      <div className="p-sub">client din {monthYear(l.created_at)}</div>
                    </div>
                  </div>
                </td>
                <td><span className="tag">{l.source}</span></td>
                <td><span className={`badge ${STAGE_BADGE[l.stage]}`}>{STAGE_LABEL[l.stage]}</span></td>
                <td className="mono">{l.value_monthly > 0 ? formatLei(l.value_monthly) : <span className="faint">—</span>}</td>
                <td>
                  {l.owner ? (
                    <div className="p-avatar" style={{ width: 26, height: 26, fontSize: 10 }}>{l.owner.initials}</div>
                  ) : (
                    <span className="faint">—</span>
                  )}
                </td>
                <td className="faint">{timeAgo(l.last_activity_at)}</td>
                {canDelete && (
                  <td onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="icon-btn"
                      style={{ width: 28, height: 28, color: "var(--danger)" }}
                      title="Șterge clientul"
                      onClick={() => openConfirm([l.id])}
                    >
                      🗑
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={canDelete ? 8 : 6}>
                  <div className="empty-note">Niciun client nu corespunde filtrelor alese.</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {confirmIds && (
        <div className="modal-overlay" onClick={closeConfirm}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Șterge {confirmIds.length > 1 ? `${confirmIds.length} clienți` : "client"}</h3>
              <button className="modal-close" onClick={closeConfirm}>✕</button>
            </div>

            {confirmStep === 1 ? (
              <>
                <p style={{ marginBottom: 4 }}>
                  Sigur vrei să ștergi {confirmIds.length > 1 ? "acești clienți" : "acest client"}?
                </p>
                <div className="list" style={{ marginBottom: 14, maxHeight: 160, overflowY: "auto" }}>
                  {confirmTargets.map((l) => (
                    <div key={l.id} className="list-row" style={{ padding: "8px 4px" }}>
                      <span className="p-name" style={{ fontSize: 13 }}>{l.name}</span>
                    </div>
                  ))}
                </div>
                <div className="field-error" style={{ marginBottom: 14 }}>
                  Acțiunea este ireversibilă — se pierd istoricul, notele și valoarea asociată.
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
                  {confirmIds.length > 1 ? ` cei ${confirmIds.length} clienți` : " acest client"}.
                </p>
                <div className="field">
                  <input
                    autoFocus
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder={CONFIRM_WORD}
                  />
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

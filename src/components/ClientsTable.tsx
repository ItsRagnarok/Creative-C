"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { STAGES, STAGE_LABEL, STAGE_BADGE, formatLei, timeAgo, monthYear, type LeadStage } from "@/lib/pipeline";
import type { LeadRow } from "@/components/PipelineBoard";

export default function ClientsTable({ initialLeads }: { initialLeads: LeadRow[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<LeadStage | "toate">("toate");
  const [sourceFilter, setSourceFilter] = useState("toate");
  const [ownerFilter, setOwnerFilter] = useState("toate");

  const sources = useMemo(
    () => Array.from(new Set(initialLeads.map((l) => l.source))).sort(),
    [initialLeads],
  );
  const owners = useMemo(() => {
    const map = new Map<string, string>();
    initialLeads.forEach((l) => {
      if (l.owner) map.set(l.owner.id, l.owner.full_name);
    });
    return Array.from(map.entries());
  }, [initialLeads]);

  const filtered = useMemo(() => {
    return initialLeads.filter((l) => {
      if (search && !l.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (stageFilter !== "toate" && l.stage !== stageFilter) return false;
      if (sourceFilter !== "toate" && l.source !== sourceFilter) return false;
      if (ownerFilter !== "toate" && l.owner_id !== ownerFilter) return false;
      return true;
    });
  }, [initialLeads, search, stageFilter, sourceFilter, ownerFilter]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Clienți</h1>
          <p>{initialLeads.length} clienți/lead-uri · istoric, sursă, status și valoare.</p>
        </div>
        <button className="btn primary" onClick={() => router.push("/dashboard")}>
          + Client nou (din Pipeline)
        </button>
      </div>

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
              <th>Client</th>
              <th>Sursă</th>
              <th>Status</th>
              <th>Valoare/lună</th>
              <th>Responsabil</th>
              <th>Ultima activitate</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((l) => (
              <tr key={l.id} className="row-link" onClick={() => router.push(`/clienti/${l.id}`)}>
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
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6}>
                  <div className="empty-note">Niciun client nu corespunde filtrelor alese.</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AUTOMATION_UNIT, AUTOMATION_ICON, timeAgo, type AutomationKind } from "@/lib/automatizari";

export type AutomationRuleRow = {
  id: string;
  kind: AutomationKind;
  label: string;
  description: string;
  enabled: boolean;
  threshold: number;
};

export type AutomationLogRow = {
  id: string;
  rule_kind: AutomationKind;
  summary: string;
  target_type: string | null;
  created_at: string;
};

export default function AutomationsBoard({
  initialRules,
  initialLog,
}: {
  initialRules: AutomationRuleRow[];
  initialLog: AutomationLogRow[];
}) {
  const supabase = createClient();
  const [rules, setRules] = useState(initialRules);
  const [log, setLog] = useState(initialLog);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  async function toggleRule(rule: AutomationRuleRow) {
    const { data, error } = await supabase
      .from("automation_rules")
      .update({ enabled: !rule.enabled })
      .eq("id", rule.id)
      .select("*")
      .single();
    if (error) return;
    setRules((prev) => prev.map((r) => (r.id === rule.id ? (data as AutomationRuleRow) : r)));
  }

  async function saveThreshold(rule: AutomationRuleRow) {
    const raw = drafts[rule.id];
    const value = Number(raw);
    if (!raw || !Number.isFinite(value) || value <= 0) return;
    setSavingId(rule.id);
    const { data, error } = await supabase
      .from("automation_rules")
      .update({ threshold: value })
      .eq("id", rule.id)
      .select("*")
      .single();
    setSavingId(null);
    if (error) return;
    setRules((prev) => prev.map((r) => (r.id === rule.id ? (data as AutomationRuleRow) : r)));
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[rule.id];
      return next;
    });
  }

  async function runNow() {
    setRunning(true);
    setRunResult(null);
    setRunError(null);
    const { data, error } = await supabase.rpc("run_automations");
    setRunning(false);
    if (error) {
      setRunError(error.message);
      return;
    }
    setRunResult(data === 1 ? "1 alertă nouă declanșată." : `${data} alerte noi declanșate.`);
    const { data: freshLog } = await supabase
      .from("automation_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30);
    if (freshLog) setLog(freshLog as AutomationLogRow[]);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Automatizări</h1>
          <p>Reguli care rulează automat din oră în oră și trimit notificări echipei.</p>
        </div>
        <button className="btn primary" onClick={runNow} disabled={running}>
          {running ? "Se rulează…" : "Rulează acum"}
        </button>
      </div>

      {runResult && <div className="empty-note" style={{ marginBottom: 18, textAlign: "left", borderColor: "var(--accent-2)" }}>{runResult}</div>}
      {runError && <div className="field-error" style={{ marginBottom: 18 }}>{runError}</div>}

      <div className="grid g-2" style={{ marginBottom: 24 }}>
        {rules.map((rule) => (
          <div key={rule.id} className="card">
            <div className="card-title">
              <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span>{AUTOMATION_ICON[rule.kind]}</span> {rule.label}
              </h3>
              <button
                type="button"
                className={`switch ${rule.enabled ? "on" : ""}`}
                onClick={() => toggleRule(rule)}
                title={rule.enabled ? "Dezactivează" : "Activează"}
              />
            </div>
            <p style={{ fontSize: 12.5 }}>{rule.description}</p>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
              <span className="faint" style={{ fontSize: 12 }}>Prag:</span>
              <input
                type="number"
                min="1"
                value={drafts[rule.id] ?? rule.threshold}
                onChange={(e) => setDrafts({ ...drafts, [rule.id]: e.target.value })}
                style={{ width: 70, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 8px", fontSize: 12.5 }}
              />
              <span className="faint" style={{ fontSize: 12 }}>{AUTOMATION_UNIT[rule.kind]}</span>
              {drafts[rule.id] != null && Number(drafts[rule.id]) !== rule.threshold && (
                <button type="button" className="btn sm primary" onClick={() => saveThreshold(rule)} disabled={savingId === rule.id}>
                  {savingId === rule.id ? "…" : "Salvează"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="section-title"><h2>Istoric declanșări</h2></div>
      <div className="card" style={{ padding: 0 }}>
        <div className="list" style={{ padding: "4px 18px" }}>
          {log.map((entry) => (
            <div key={entry.id} className="list-row">
              <span style={{ fontSize: 15 }}>{AUTOMATION_ICON[entry.rule_kind]}</span>
              <span style={{ flex: 1, fontSize: 13 }}>{entry.summary}</span>
              <span className="faint" style={{ fontSize: 11.5 }}>{timeAgo(entry.created_at)}</span>
            </div>
          ))}
          {log.length === 0 && <div className="empty-note">Nicio alertă declanșată încă.</div>}
        </div>
      </div>
    </>
  );
}

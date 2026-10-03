"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeRefetch } from "@/lib/useRealtimeRows";
import type { CalendarEditor } from "@/components/ContentCalendar";
import { ROLE_LABEL, type AppRole } from "@/lib/roles";

type CardRow = {
  id: string;
  editor_id: string;
  color: "rosu" | "galben" | "verde";
  reason: string;
  created_at: string;
};

const COLORS: { key: CardRow["color"]; emoji: string; label: string }[] = [
  { key: "rosu", emoji: "🔴", label: "Roșu" },
  { key: "galben", emoji: "🟡", label: "Galben" },
  { key: "verde", emoji: "🟢", label: "Verde" },
];
const EMOJI = Object.fromEntries(COLORS.map((c) => [c.key, c.emoji])) as Record<CardRow["color"], string>;

type PenaltyDay = { day: string; expected: number; uploaded: number; missing: number; penalty: number; clients: string | null };
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const shiftMonth = (m: string, delta: number) => {
  const [y, mo] = m.split("-").map(Number);
  return monthKey(new Date(y, mo - 1 + delta, 1));
};
const monthLabel = (m: string) => {
  const [y, mo] = m.split("-").map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString("ro-RO", { month: "long", year: "numeric" });
};

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("ro-RO", { day: "numeric", month: "short", year: "numeric" });
}

export default function EditorCards({
  editors,
  canManage,
  canGive: isAdminViewer,
  isSuper,
  currentUserId,
}: {
  editors: CalendarEditor[];
  canManage: boolean;
  canGive: boolean;
  isSuper: boolean;
  currentUserId: string;
}) {
  const supabase = createClient();
  const [editorId, setEditorId] = useState<string | null>(canManage ? editors[0]?.id ?? null : currentUserId);
  const [cards, setCards] = useState<CardRow[]>([]);
  const [loading, setLoading] = useState(!!editorId);
  const [error, setError] = useState<string | null>(null);
  const [color, setColor] = useState<CardRow["color"]>("galben");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const [penalties, setPenalties] = useState<PenaltyDay[]>([]);

  const fetchCards = useCallback(
    async (id: string) =>
      supabase.from("editor_cards").select("*").eq("editor_id", id).order("created_at", { ascending: false }),
    [supabase],
  );

  useEffect(() => {
    if (!editorId) return;
    let cancelled = false;
    fetchCards(editorId).then(({ data, error: err }) => {
      if (cancelled) return;
      if (err) setError(err.message);
      else setCards((data ?? []) as CardRow[]);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [editorId, fetchCards]);

  useRealtimeRefetch("editor_cards", () => {
    if (editorId) fetchCards(editorId).then(({ data }) => data && setCards(data as CardRow[]));
  });

  // Money penalties for the chosen month (25 lei per clip not uploaded by 17:00), computed in the database.
  const loadPenalties = useCallback(
    (id: string, m: string) =>
      supabase.rpc("editor_penalties_v2", { p_editor: id, p_month: `${m}-01` }).then(({ data }) => setPenalties((data ?? []) as PenaltyDay[])),
    [supabase],
  );
  useEffect(() => {
    if (!editorId) return;
    let cancelled = false;
    supabase.rpc("editor_penalties_v2", { p_editor: editorId, p_month: `${month}-01` }).then(({ data }) => {
      if (!cancelled) setPenalties((data ?? []) as PenaltyDay[]);
    });
    return () => {
      cancelled = true;
    };
  }, [editorId, month, supabase]);
  useRealtimeRefetch("content_calendar", () => {
    if (editorId) loadPenalties(editorId, month);
  });
  const penaltyTotal = penalties.reduce((sum, d) => sum + d.penalty, 0);

  function pick(id: string) {
    setError(null);
    setLoading(true);
    setEditorId(id);
  }

  async function addCard(e: React.FormEvent) {
    e.preventDefault();
    if (!editorId || !reason.trim()) return;
    setSaving(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("editor_cards")
      .insert({ editor_id: editorId, color, reason: reason.trim(), created_by: currentUserId })
      .select("*")
      .single();
    setSaving(false);
    if (err) return setError(err.message);
    setCards((prev) => [data as CardRow, ...prev]);
    setReason("");
  }

  async function removeCard(id: string) {
    setError(null);
    const { error: err } = await supabase.from("editor_cards").delete().eq("id", id);
    if (err) return setError(err.message);
    setCards((prev) => prev.filter((c) => c.id !== id));
  }

  const editor = editors.find((e) => e.id === editorId) ?? null;
  // Admin S can give cards to anyone, admins included; other admins to everyone except admins; never to oneself.
  const canGive = isAdminViewer && !!editor && editor.id !== currentUserId && (isSuper || editor.role !== "admin");
  const count = (k: CardRow["color"]) => cards.filter((c) => c.color === k).length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Editor credits</h1>
          <p>{isAdminViewer ? "Cartonașele și penalizările în bani ale fiecărui membru. Doar adminii pot da cartonașe." : canManage ? "Cartonașele și penalizările echipei. Doar adminii dau cartonașe." : "Cartonașele tale și penalizările din luna aleasă."}</p>
        </div>
      </div>

      <div className="chat-shell no-side" style={{ gridTemplateColumns: canManage ? undefined : "1fr" }}>
        {canManage && (
          <div className="chan-list">
            <div className="nav-label" style={{ padding: "4px 10px" }}>Echipă</div>
            {editors.map((ed) => (
              <button key={ed.id} className={`chan-item${editorId === ed.id ? " active" : ""}`} onClick={() => pick(ed.id)}>
                <span className="status-dot" style={{ background: "var(--accent-2)" }} />
                {ed.full_name}{ed.role && ed.role !== "editor" ? <span className="faint" style={{ marginLeft: 6, fontSize: 11 }}>{ROLE_LABEL[ed.role as AppRole] ?? ed.role}</span> : null}
              </button>
            ))}
            {editors.length === 0 && <div className="empty-note">Niciun membru.</div>}
          </div>
        )}

        <div className="chat-main" style={{ padding: 18 }}>
          {editorId ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14, flexWrap: "wrap" }}>
                {editor && <b>{editor.full_name}</b>}
                {COLORS.map((c) => (
                  <span key={c.key} className="badge gray">{c.emoji} {count(c.key)}</span>
                ))}
              </div>

              {/* Penalties in money, per month */}
              <div className="card" style={{ padding: "12px 16px", marginBottom: 14, background: "var(--surface-2)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <button type="button" className="btn sm ghost" onClick={() => setMonth((m) => shiftMonth(m, -1))} aria-label="Luna anterioară">‹</button>
                  <b style={{ textTransform: "capitalize", minWidth: 120, textAlign: "center" }}>{monthLabel(month)}</b>
                  <button type="button" className="btn sm ghost" onClick={() => setMonth((m) => shiftMonth(m, 1))} aria-label="Luna următoare">›</button>
                  <div style={{ marginLeft: "auto", textAlign: "right" }}>
                    <div className="faint" style={{ fontSize: 11 }}>PENALIZĂRI ÎN BANI</div>
                    <b style={{ fontSize: 18, color: penaltyTotal ? "var(--danger)" : undefined }}>{penaltyTotal ? `−${penaltyTotal}` : "0"} lei</b>
                  </div>
                </div>
                <div className="faint" style={{ fontSize: 11.5, marginTop: 6 }}>Fiecare clip neîncărcat până la 17:00 din ziua lui înseamnă −25 lei.</div>
                {penalties.length > 0 && (
                  <div style={{ marginTop: 8, display: "grid", gap: 4, fontSize: 12.5 }}>
                    {penalties.map((d) => (
                      <div key={d.day}>
                        {new Date(d.day + "T00:00:00").toLocaleDateString("ro-RO", { day: "numeric", month: "short" })}: {d.uploaded} din {d.expected} clipuri încărcate până la 17:00{d.clients ? ` (lipsă: ${d.clients})` : ""} → <b style={{ color: "var(--danger)" }}>−{d.penalty} lei</b>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {canGive && (
                <form onSubmit={addCard} style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
                  <select value={color} onChange={(e) => setColor(e.target.value as CardRow["color"])}>
                    {COLORS.map((c) => (
                      <option key={c.key} value={c.key}>{c.emoji} {c.label}</option>
                    ))}
                  </select>
                  <input
                    style={{ flex: 1, minWidth: 180 }}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Motiv (ex: clip predat cu întârziere)"
                  />
                  <button type="submit" className="btn primary sm" disabled={saving || !reason.trim()}>
                    {saving ? "…" : "Dă cartonaș"}
                  </button>
                </form>
              )}

              {error && <div className="field-error" style={{ marginBottom: 10 }}>{error}</div>}

              <div className="list">
                {cards.map((c) => (
                  <div key={c.id} className="list-row" style={{ gap: 12, alignItems: "center" }}>
                    <span style={{ fontSize: 20 }}>{EMOJI[c.color]}</span>
                    <div style={{ flex: 1 }}>
                      <div>{c.reason}</div>
                      <div className="faint" style={{ fontSize: 11 }}>{fmt(c.created_at)}</div>
                    </div>
                    {canGive && (
                      <button type="button" className="icon-btn" style={{ width: 28, height: 28 }} title="Șterge" onClick={() => removeCard(c.id)}>
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                {!loading && cards.length === 0 && <div className="empty-note">Niciun cartonaș.</div>}
              </div>
            </>
          ) : (
            <div className="empty-note">Alege un editor.</div>
          )}
        </div>
      </div>
    </>
  );
}

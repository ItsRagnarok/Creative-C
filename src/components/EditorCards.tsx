"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CalendarEditor } from "@/components/ContentCalendar";

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

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("ro-RO", { day: "numeric", month: "short", year: "numeric" });
}

export default function EditorCards({
  editors,
  canManage,
  canGive,
  currentUserId,
}: {
  editors: CalendarEditor[];
  canManage: boolean;
  canGive: boolean;
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
  const count = (k: CardRow["color"]) => cards.filter((c) => c.color === k).length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Cartonașe</h1>
          <p>{canGive ? "Sancțiuni și observații pentru fiecare editor, cu motivul scris. Doar adminul poate da cartonașe." : canManage ? "Cartonașele fiecărui editor. Doar adminul le poate da." : "Cartonașele primite, cu motivul fiecăruia."}</p>
        </div>
      </div>

      <div className="chat-shell no-side" style={{ gridTemplateColumns: canManage ? undefined : "1fr" }}>
        {canManage && (
          <div className="chan-list">
            <div className="nav-label" style={{ padding: "4px 10px" }}>Editori</div>
            {editors.map((ed) => (
              <button key={ed.id} className={`chan-item${editorId === ed.id ? " active" : ""}`} onClick={() => pick(ed.id)}>
                <span className="status-dot" style={{ background: "var(--accent-2)" }} />
                {ed.full_name}
              </button>
            ))}
            {editors.length === 0 && <div className="empty-note">Niciun editor. Adaugă unul din Echipă.</div>}
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

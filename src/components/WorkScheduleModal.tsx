"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type AvailabilityRow = { id: string; user_id: string; weekday: number; start_time: string; end_time: string };

type Range = { start: string; end: string };
const DAYS = ["Luni", "Marți", "Miercuri", "Joi", "Vineri", "Sâmbătă", "Duminică"];
const hhmm = (t: string) => t.slice(0, 5);

function toWeek(rows: AvailabilityRow[]): Range[][] {
  const week: Range[][] = Array.from({ length: 7 }, () => []);
  [...rows]
    .sort((a, b) => a.start_time.localeCompare(b.start_time))
    .forEach((r) => week[r.weekday - 1].push({ start: hhmm(r.start_time), end: hhmm(r.end_time) }));
  return week;
}

export default function WorkScheduleModal({
  userId,
  initial,
  onClose,
}: {
  userId: string;
  initial: AvailabilityRow[];
  onClose: (saved?: AvailabilityRow[]) => void;
}) {
  const supabase = createClient();
  const [week, setWeek] = useState<Range[][]>(() => toWeek(initial));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setRange(day: number, idx: number, patch: Partial<Range>) {
    setWeek((w) => w.map((rs, d) => (d === day ? rs.map((r, i) => (i === idx ? { ...r, ...patch } : r)) : rs)));
  }

  async function save() {
    for (const [d, rs] of week.entries()) {
      for (const r of rs) {
        if (!r.start || !r.end || r.end <= r.start) return setError(`${DAYS[d]}: ora de sfârșit trebuie să fie după cea de început.`);
      }
    }
    setSaving(true);
    setError(null);
    const { error: delErr } = await supabase.from("availability").delete().eq("user_id", userId);
    if (delErr) {
      setSaving(false);
      return setError(delErr.message);
    }
    const rows = week.flatMap((rs, d) => rs.map((r) => ({ user_id: userId, weekday: d + 1, start_time: r.start, end_time: r.end })));
    let saved: AvailabilityRow[] = [];
    if (rows.length > 0) {
      const { data, error: insErr } = await supabase.from("availability").insert(rows).select("*");
      if (insErr) {
        setSaving(false);
        return setError(insErr.message);
      }
      saved = data as AvailabilityRow[];
    }
    setSaving(false);
    onClose(saved);
  }

  return (
    <div className="modal-overlay" onClick={() => onClose()}>
      <div className="modal" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Program de lucru</h3>
          <button className="modal-close" onClick={() => onClose()}>✕</button>
        </div>
        {DAYS.map((label, d) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", flexWrap: "wrap" }}>
            <div style={{ width: 84, fontWeight: 600, fontSize: 13 }}>{label}</div>
            {week[d].length === 0 && <span className="faint" style={{ fontSize: 12 }}>Liber / indisponibil</span>}
            {week[d].map((r, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input type="time" step={1200} value={r.start} onChange={(e) => setRange(d, i, { start: e.target.value })} />
                <span>–</span>
                <input type="time" step={1200} value={r.end} onChange={(e) => setRange(d, i, { end: e.target.value })} />
                <button type="button" className="icon-btn" style={{ width: 26, height: 26 }} title="Șterge intervalul" onClick={() => setWeek((w) => w.map((rs, dd) => (dd === d ? rs.filter((_, ii) => ii !== i) : rs)))}>✕</button>
              </div>
            ))}
            <button type="button" className="btn sm ghost" onClick={() => setWeek((w) => w.map((rs, dd) => (dd === d ? [...rs, { start: "10:00", end: "12:00" }] : rs)))}>
              + interval
            </button>
          </div>
        ))}
        {error && <div className="field-error">{error}</div>}
        <button type="button" className="btn primary" style={{ width: "100%", justifyContent: "center", marginTop: 14 }} onClick={save} disabled={saving}>
          {saving ? "Se salvează…" : "Salvează programul"}
        </button>
      </div>
    </div>
  );
}

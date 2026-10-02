"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type AvailabilityRow = { id: string; user_id: string; weekday: number; start_time: string; end_time: string };
export type GeneralRow = { id: string; weekday: number; start_time: string; end_time: string };
type TimeRow = { weekday: number; start_time: string; end_time: string };

type Range = { start: string; end: string };
const DAYS = ["Luni", "Marți", "Miercuri", "Joi", "Vineri", "Sâmbătă", "Duminică"];
const hhmm = (t: string) => t.slice(0, 5);

function toWeek(rows: TimeRow[]): Range[][] {
  const week: Range[][] = Array.from({ length: 7 }, () => []);
  [...rows]
    .sort((a, b) => a.start_time.localeCompare(b.start_time))
    .forEach((r) => week[r.weekday - 1].push({ start: hhmm(r.start_time), end: hhmm(r.end_time) }));
  return week;
}

// One weekly editor (days × time ranges), used for both a person's own hours and the general link's hours.
function WeekEditor({ week, setWeek, days }: { week: Range[][]; setWeek: React.Dispatch<React.SetStateAction<Range[][]>>; days: number }) {
  const setRange = (d: number, i: number, patch: Partial<Range>) =>
    setWeek((w) => w.map((rs, dd) => (dd === d ? rs.map((r, ii) => (ii === i ? { ...r, ...patch } : r)) : rs)));
  return (
    <>
      {DAYS.slice(0, days).map((label, d) => (
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
    </>
  );
}

function invalid(week: Range[][], days: number) {
  for (let d = 0; d < days; d++) {
    for (const r of week[d]) {
      if (!r.start || !r.end || r.end <= r.start) return `${DAYS[d]}: ora de sfârșit trebuie să fie după cea de început.`;
    }
  }
  return null;
}

export default function WorkScheduleModal({
  userId,
  initial,
  general,
  onClose,
}: {
  userId: string;
  initial: AvailabilityRow[];
  general?: GeneralRow[] | null; // only admin S gets the "Link general" tab
  onClose: (saved?: { personal?: AvailabilityRow[]; general?: GeneralRow[] }) => void;
}) {
  const supabase = createClient();
  const [tab, setTab] = useState<"mine" | "general">("mine");
  const [week, setWeek] = useState<Range[][]>(() => toWeek(initial));
  const [gweek, setGweek] = useState<Range[][]>(() => toWeek(general ?? []));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const isGeneral = tab === "general";
    const days = isGeneral ? 5 : 7; // the general link runs Monday–Friday
    const w = isGeneral ? gweek : week;
    const bad = invalid(w, days);
    if (bad) return setError(bad);
    setSaving(true);
    setError(null);

    if (isGeneral) {
      const { error: delErr } = await supabase.from("general_availability").delete().gte("weekday", 1);
      if (delErr) return fail(delErr.message);
      const rows = w.slice(0, 5).flatMap((rs, d) => rs.map((r) => ({ weekday: d + 1, start_time: r.start, end_time: r.end })));
      let saved: GeneralRow[] = [];
      if (rows.length > 0) {
        const { data, error: insErr } = await supabase.from("general_availability").insert(rows).select("*");
        if (insErr) return fail(insErr.message);
        saved = data as GeneralRow[];
      }
      setSaving(false);
      return onClose({ general: saved });
    }

    const { error: delErr } = await supabase.from("availability").delete().eq("user_id", userId);
    if (delErr) return fail(delErr.message);
    const rows = w.flatMap((rs, d) => rs.map((r) => ({ user_id: userId, weekday: d + 1, start_time: r.start, end_time: r.end })));
    let saved: AvailabilityRow[] = [];
    if (rows.length > 0) {
      const { data, error: insErr } = await supabase.from("availability").insert(rows).select("*");
      if (insErr) return fail(insErr.message);
      saved = data as AvailabilityRow[];
    }
    setSaving(false);
    onClose({ personal: saved });
  }

  function fail(message: string) {
    setSaving(false);
    setError(message);
  }

  return (
    <div className="modal-overlay" onClick={() => onClose()}>
      <div className="modal" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Program de lucru</h3>
          <button className="modal-close" onClick={() => onClose()}>✕</button>
        </div>

        {general && (
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <button type="button" className={`btn sm ${tab === "mine" ? "primary" : "ghost"}`} onClick={() => { setTab("mine"); setError(null); }}>Programul meu</button>
            <button type="button" className={`btn sm ${tab === "general" ? "primary" : "ghost"}`} onClick={() => { setTab("general"); setError(null); }}>Program link general</button>
          </div>
        )}
        {tab === "general" && (
          <p className="faint" style={{ fontSize: 12, marginBottom: 10 }}>
            Orele în care clienții se pot programa pe linkul general (luni–vineri). Nu depinde de programele personale: o oră dispare doar dacă tot grupul (admin S, admini, manageri, closeri) are deja o programare atunci.
          </p>
        )}

        {tab === "mine" ? <WeekEditor week={week} setWeek={setWeek} days={7} /> : <WeekEditor week={gweek} setWeek={setGweek} days={5} />}

        {error && <div className="field-error">{error}</div>}
        <button type="button" className="btn primary" style={{ width: "100%", justifyContent: "center", marginTop: 14 }} onClick={save} disabled={saving}>
          {saving ? "Se salvează…" : tab === "general" ? "Salvează programul linkului general" : "Salvează programul"}
        </button>
      </div>
    </div>
  );
}

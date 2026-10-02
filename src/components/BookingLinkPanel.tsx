"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type AvailabilityRow = { id: string; user_id: string; weekday: number; start_time: string; end_time: string };
export type TeamMember = { id: string; full_name: string; initials: string; role: string; booking_slug: string | null };

type Range = { start: string; end: string };
const DAYS = ["Luni", "Marți", "Miercuri", "Joi", "Vineri", "Sâmbătă", "Duminică"];
const hhmm = (t: string) => t.slice(0, 5);

function toWeek(rows: AvailabilityRow[], userId: string): Range[][] {
  const week: Range[][] = Array.from({ length: 7 }, () => []);
  rows
    .filter((r) => r.user_id === userId)
    .sort((a, b) => a.start_time.localeCompare(b.start_time))
    .forEach((r) => week[r.weekday - 1].push({ start: hhmm(r.start_time), end: hhmm(r.end_time) }));
  return week;
}

export default function BookingLinkPanel({
  userId,
  team,
  availability,
  canSeeTeam,
}: {
  userId: string;
  team: TeamMember[];
  availability: AvailabilityRow[];
  canSeeTeam: boolean;
}) {
  const supabase = createClient();
  const [slug, setSlug] = useState<string | null>(team.find((t) => t.id === userId)?.booking_slug ?? null);
  const [week, setWeek] = useState<Range[][]>(() => toWeek(availability, userId));
  const [teamAvail, setTeamAvail] = useState(availability);
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    Promise.resolve().then(() => setOrigin(window.location.origin));
    if (!slug) {
      supabase.rpc("ensure_booking_slug").then(({ data }) => {
        if (data) setSlug(data);
      });
    }
  }, [slug, supabase]);

  const link = slug && origin ? `${origin}/programeaza/${slug}` : "";

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt("Copiază linkul:", text);
    }
  }

  function setRange(day: number, idx: number, patch: Partial<Range>) {
    setWeek((w) => w.map((rs, d) => (d === day ? rs.map((r, i) => (i === idx ? { ...r, ...patch } : r)) : rs)));
  }

  async function save() {
    for (const [d, rs] of week.entries()) {
      for (const r of rs) {
        if (!r.start || !r.end || r.end <= r.start) {
          return setMsg(`${DAYS[d]}: ora de sfârșit trebuie să fie după cea de început.`);
        }
      }
    }
    setSaving(true);
    setMsg(null);
    const { error: delErr } = await supabase.from("availability").delete().eq("user_id", userId);
    if (delErr) {
      setSaving(false);
      return setMsg(delErr.message);
    }
    const rows = week.flatMap((rs, d) => rs.map((r) => ({ user_id: userId, weekday: d + 1, start_time: r.start, end_time: r.end })));
    if (rows.length > 0) {
      const { data, error: insErr } = await supabase.from("availability").insert(rows).select("*");
      if (insErr) {
        setSaving(false);
        return setMsg(insErr.message);
      }
      setTeamAvail((prev) => [...prev.filter((r) => r.user_id !== userId), ...(data as AvailabilityRow[])]);
    } else {
      setTeamAvail((prev) => prev.filter((r) => r.user_id !== userId));
    }
    setSaving(false);
    setMsg("Salvat.");
  }

  const others = team.filter((t) => t.id !== userId);

  return (
    <details className="card" style={{ marginBottom: 18 }}>
      <summary style={{ cursor: "pointer", fontWeight: 700 }}>🔗 Linkul meu de programare și programul meu</summary>

      <div style={{ marginTop: 14 }}>
        <div className="field">
          <label>Linkul tău (îl trimiți clienților)</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input readOnly value={link} placeholder="Se generează…" style={{ flex: 1 }} onFocus={(e) => e.currentTarget.select()} />
            <button type="button" className="btn sm" disabled={!link} onClick={() => copy(link)}>
              {copied ? "Copiat ✓" : "Copiază"}
            </button>
          </div>
          <div className="faint" style={{ fontSize: 12, marginTop: 4 }}>
            Clientul vede orele libere ale echipei. Dacă alege o oră în care tu nu lucrezi, e programat automat la un coleg liber, iar tu primești o notificare.
          </div>
        </div>

        <div className="nav-label" style={{ padding: 0, margin: "14px 0 8px" }}>Zilele și orele în care ești liber</div>
        {DAYS.map((label, d) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", flexWrap: "wrap" }}>
            <div style={{ width: 90, fontWeight: 600, fontSize: 13 }}>{label}</div>
            {week[d].length === 0 && <span className="faint" style={{ fontSize: 12 }}>Indisponibil</span>}
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
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10 }}>
          <button type="button" className="btn primary sm" onClick={save} disabled={saving}>{saving ? "Se salvează…" : "Salvează programul"}</button>
          {msg && <span className="faint" style={{ fontSize: 12 }}>{msg}</span>}
        </div>

        {canSeeTeam && others.length > 0 && (
          <>
            <div className="nav-label" style={{ padding: 0, margin: "22px 0 8px" }}>Echipa — linkuri și program</div>
            <div className="list">
              {others.map((m) => {
                const w = toWeek(teamAvail, m.id);
                const summary = w
                  .map((rs, d) => (rs.length ? `${DAYS[d].slice(0, 3)} ${rs.map((r) => `${r.start}-${r.end}`).join(", ")}` : null))
                  .filter(Boolean)
                  .join(" · ");
                const mLink = m.booking_slug && origin ? `${origin}/programeaza/${m.booking_slug}` : "";
                return (
                  <div key={m.id} className="list-row" style={{ gap: 12, alignItems: "center" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="p-name" style={{ fontSize: 13 }}>{m.full_name}</div>
                      <div className="faint" style={{ fontSize: 11.5 }}>{summary || "Program necompletat"}</div>
                    </div>
                    {mLink ? (
                      <button type="button" className="btn sm ghost" onClick={() => copy(mLink)}>Copiază link</button>
                    ) : (
                      <span className="faint" style={{ fontSize: 11.5 }}>fără link încă</span>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </details>
  );
}

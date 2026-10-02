"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const TZ = "Europe/Bucharest";
const DOW = ["L", "Ma", "Mi", "J", "V", "S", "D"];

// YYYY-MM-DD of an instant as seen in Romania, regardless of the visitor's own timezone.
const dayKey = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: TZ });
const timeLabel = (d: Date) => d.toLocaleTimeString("ro-RO", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const pad = (n: number) => String(n).padStart(2, "0");

type Confirmed = { slot: string; assigned: string };

export default function PublicBooking({ slug }: { slug: string | null }) {
  const supabase = createClient();
  const [host, setHost] = useState<{ full_name: string; initials: string } | null>(null);
  const [hostMissing, setHostMissing] = useState(false);
  const [month, setMonth] = useState(() => {
    const n = new Date();
    return { y: n.getFullYear(), m: n.getMonth() };
  });
  const [slots, setSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickedDay, setPickedDay] = useState<string | null>(null);
  const [pickedSlot, setPickedSlot] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Confirmed | null>(null);

  useEffect(() => {
    if (!slug) return;
    supabase.rpc("get_booking_host", { p_slug: slug }).then(({ data }) => {
      if (data && data.length > 0) setHost(data[0]);
      else setHostMissing(true);
    });
  }, [slug, supabase]);

  const from = `${month.y}-${pad(month.m + 1)}-01`;
  const to = `${month.y}-${pad(month.m + 1)}-${pad(new Date(month.y, month.m + 1, 0).getDate())}`;

  useEffect(() => {
    let cancelled = false;
    supabase.rpc("list_available_slots", { p_slug: slug as string, p_from: from, p_to: to }).then(({ data }) => {
      if (cancelled) return;
      setSlots((data ?? []).map((r) => r.slot));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [slug, from, to, supabase]);

  const byDay = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const s of slots) {
      const k = dayKey(new Date(s));
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(s);
    }
    return map;
  }, [slots]);

  function goMonth(delta: number) {
    setLoading(true);
    setPickedDay(null);
    setMonth((cur) => {
      const d = new Date(cur.y, cur.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  }

  const now = new Date();
  const atCurrentMonth = month.y === now.getFullYear() && month.m === now.getMonth();
  const firstDow = (new Date(month.y, month.m, 1).getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(month.y, month.m + 1, 0).getDate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pickedSlot) return;
    if (!name.trim()) return setError("Numele este obligatoriu.");
    if (!email.trim() && !phone.trim()) return setError("Lasă un email sau un telefon, ca să te putem contacta.");
    setSubmitting(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc("book_slot", {
      p_slug: slug as string,
      p_name: name.trim(),
      p_email: email.trim(),
      p_phone: phone.trim(),
      p_slot: pickedSlot,
    });
    setSubmitting(false);
    if (rpcError) {
      setError(rpcError.message || "Intervalul nu mai este disponibil — alege altul.");
      return;
    }
    const res = data as { assigned_name: string };
    setDone({ slot: pickedSlot, assigned: res.assigned_name });
  }

  const hostName = host?.full_name ?? "Echipa Creative C";

  if (hostMissing) {
    return (
      <div className="pb-page">
        <div className="auth-card" style={{ textAlign: "center" }}>
          <h2 style={{ fontSize: 20 }}>Link invalid</h2>
          <p>Acest link de programare nu există sau nu mai este activ.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-page">
      <div className="pb-card">
        <aside className="pb-info">
          <div className="host-avatar">{host?.initials ?? "CC"}</div>
          <div className="host-name">{hostName}</div>
          <h1>Apel de strategie</h1>
          <div className="meta">⏱ 20 minute</div>
          <div className="meta">🌍 Ora României</div>
          <p className="faint" style={{ fontSize: 12.5, marginTop: 16 }}>
            Discutăm obiectivele tale de conținut și cum arată o colaborare cu noi. Fără obligații.
          </p>
          {pickedSlot && !done && (
            <p style={{ marginTop: 16, fontSize: 13 }}>
              📅 <b>
                {new Date(pickedSlot).toLocaleDateString("ro-RO", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" })}
                {", "}
                {timeLabel(new Date(pickedSlot))}
              </b>
            </p>
          )}
        </aside>

        {done ? (
          <div className="pb-body" style={{ textAlign: "center", alignContent: "center" }}>
            <div>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
              <h2 style={{ fontSize: 20 }}>Programare confirmată!</h2>
              <p>
                Ne vedem{" "}
                {new Date(done.slot).toLocaleDateString("ro-RO", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" })} la{" "}
                {timeLabel(new Date(done.slot))}, cu <b style={{ color: "var(--text)" }}>{done.assigned}</b>.
              </p>
              <p className="faint" style={{ fontSize: 12.5 }}>Echipa Creative C a fost anunțată.</p>
            </div>
          </div>
        ) : pickedSlot ? (
          <div className="pb-body">
            <form onSubmit={handleSubmit} style={{ maxWidth: 380 }}>
              <h2 style={{ fontSize: 18, marginBottom: 14 }}>Datele tale</h2>
              <div className="field">
                <label>Nume</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Numele tău" />
              </div>
              <div className="field">
                <label>Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@afacere.ro" />
              </div>
              <div className="field">
                <label>Telefon</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07xx xxx xxx" />
              </div>
              {error && <div className="field-error">{error}</div>}
              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <button type="button" className="btn ghost" onClick={() => { setPickedSlot(null); setError(null); }}>Înapoi</button>
                <button type="submit" className="btn primary" style={{ flex: 1, justifyContent: "center" }} disabled={submitting}>
                  {submitting ? "Se confirmă…" : "Confirmă programarea"}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className={`pb-body${pickedDay ? " with-slots" : ""}`}>
            <div>
              <div className="pb-head">
                <h2>{new Date(month.y, month.m, 1).toLocaleDateString("ro-RO", { month: "long", year: "numeric" })}</h2>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="pb-nav" onClick={() => goMonth(-1)} disabled={atCurrentMonth} aria-label="Luna anterioară">‹</button>
                  <button className="pb-nav" onClick={() => goMonth(1)} aria-label="Luna următoare">›</button>
                </div>
              </div>
              <div className="pb-grid">
                {DOW.map((d) => (
                  <div key={d} className="pb-dow">{d}</div>
                ))}
                {Array.from({ length: firstDow }, (_, i) => (
                  <div key={`b${i}`} />
                ))}
                {Array.from({ length: daysInMonth }, (_, i) => {
                  const key = `${month.y}-${pad(month.m + 1)}-${pad(i + 1)}`;
                  const free = byDay.has(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={!free}
                      className={`pb-day${free ? " free" : ""}${pickedDay === key ? " picked" : ""}`}
                      onClick={() => setPickedDay(key)}
                    >
                      {i + 1}
                    </button>
                  );
                })}
              </div>
              {loading && <p className="faint" style={{ marginTop: 14, fontSize: 12.5 }}>Se încarcă disponibilitatea…</p>}
              {!loading && byDay.size === 0 && (
                <p className="faint" style={{ marginTop: 14, fontSize: 12.5 }}>Nu sunt intervale libere în această lună — încearcă luna următoare.</p>
              )}
            </div>

            {pickedDay && (
              <div className="pb-slots">
                <h3>
                  {new Date(`${pickedDay}T12:00:00`).toLocaleDateString("ro-RO", { weekday: "long", day: "numeric", month: "long" })}
                </h3>
                <div className="slot-list">
                  {(byDay.get(pickedDay) ?? []).map((s) => (
                    <button key={s} type="button" className="pb-slot" onClick={() => setPickedSlot(s)}>
                      {timeLabel(new Date(s))}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

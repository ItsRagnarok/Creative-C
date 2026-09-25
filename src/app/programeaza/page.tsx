"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const DAILY_TIMES = ["10:00", "11:30", "14:00", "15:30"];

function candidateSlots(): { day: Date; iso: string; label: string; timeLabel: string }[] {
  const slots: { day: Date; iso: string; label: string; timeLabel: string }[] = [];
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  let daysAdded = 0;
  const cursor = new Date(d);
  while (daysAdded < 8) {
    cursor.setDate(cursor.getDate() + 1);
    const dow = cursor.getDay();
    if (dow === 0 || dow === 6) continue; // skip weekends
    daysAdded++;
    for (const t of DAILY_TIMES) {
      const [h, m] = t.split(":").map(Number);
      const dt = new Date(cursor);
      dt.setHours(h, m, 0, 0);
      if (dt.getTime() < Date.now()) continue;
      slots.push({
        day: new Date(cursor),
        iso: dt.toISOString(),
        label: dt.toLocaleDateString("ro-RO", { weekday: "short", day: "numeric", month: "short" }),
        timeLabel: t,
      });
    }
  }
  return slots;
}

export default function BookingPage() {
  const supabase = createClient();
  const [taken, setTaken] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmedAt, setConfirmedAt] = useState<string | null>(null);

  const allSlots = useMemo(() => candidateSlots(), []);

  useEffect(() => {
    const from = new Date();
    const to = new Date();
    to.setDate(to.getDate() + 14);
    supabase
      .rpc("list_taken_slots", { p_from: from.toISOString(), p_to: to.toISOString() })
      .then(({ data }) => {
        setTaken(new Set((data ?? []).map((r: { scheduled_at: string }) => r.scheduled_at)));
        setLoading(false);
      });
  }, [supabase]);

  const freeSlots = allSlots.filter((s) => !taken.has(s.iso));
  const byDay = useMemo(() => {
    const map = new Map<string, typeof freeSlots>();
    freeSlots.forEach((s) => {
      const key = s.day.toDateString();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    });
    return Array.from(map.entries()).slice(0, 5);
  }, [freeSlots]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    if (!name.trim()) {
      setError("Numele este obligatoriu.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const { error: rpcError } = await supabase.rpc("create_public_booking", {
      p_name: name.trim(),
      p_email: email.trim() || null,
      p_phone: phone.trim() || null,
      p_scheduled_at: selected,
    } as never);
    setSubmitting(false);
    if (rpcError) {
      setError(rpcError.message || "Intervalul nu mai este disponibil — alege altul.");
      return;
    }
    setConfirmedAt(selected);
  }

  if (confirmedAt) {
    return (
      <div className="auth-wrap">
        <div className="auth-form-wrap" style={{ width: "100%" }}>
          <div className="auth-card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <h2 style={{ fontSize: 20 }}>Programare confirmată!</h2>
            <p>
              Te așteptăm{" "}
              {new Date(confirmedAt).toLocaleDateString("ro-RO", { weekday: "long", day: "numeric", month: "long" })}
              {" "}la{" "}
              {new Date(confirmedAt).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })}.
            </p>
            <p className="faint" style={{ fontSize: 12.5 }}>
              Vei primi un email de confirmare. Echipa Creative C a fost anunțată.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-wrap">
      <div className="auth-side">
        <div style={{ position: "relative" }}>
          <div className="brand" style={{ padding: "0 0 40px" }}>
            <div className="brand-mark" style={{ width: 44, height: 44, fontSize: 18 }}>CC</div>
            <div>
              <div className="brand-name" style={{ fontSize: 19 }}>Creative C</div>
              <div className="brand-sub">Programare apel de strategie</div>
            </div>
          </div>
          <h1 style={{ fontSize: 30, maxWidth: 440 }}>Apel de strategie — 20 min, gratuit.</h1>
          <p style={{ maxWidth: 400, marginTop: 10 }}>
            Discutăm obiectivele tale de conținut și cum arată o colaborare cu noi. Fără obligații.
          </p>
          <div className="security-list">
            <div className="item"><span className="ic">📅</span> Alegi tu ziua și ora, din sloturile libere.</div>
            <div className="item"><span className="ic">⚡</span> Confirmarea e instant — nu aștepți un răspuns.</div>
            <div className="item"><span className="ic">🔒</span> Datele tale ajung direct la echipa Creative C, criptat.</div>
          </div>
        </div>
      </div>

      <div className="auth-form-wrap">
        <div className="auth-card" style={{ maxWidth: 420 }}>
          {!selected ? (
            <>
              <h2 style={{ fontSize: 20 }}>Alege un interval</h2>
              <p style={{ marginBottom: 18 }}>Zilele lucrătoare, sloturi de 20 de minute.</p>
              {loading && <p className="faint">Se încarcă sloturile disponibile…</p>}
              {!loading && byDay.length === 0 && (
                <div className="empty-note">Nu mai sunt sloturi libere în perioada afișată — revino mai târziu.</div>
              )}
              {!loading &&
                byDay.map(([day, slots]) => (
                  <div key={day} style={{ marginBottom: 16 }}>
                    <div className="nav-label" style={{ padding: 0, marginBottom: 8, textTransform: "capitalize" }}>
                      {new Date(day).toLocaleDateString("ro-RO", { weekday: "long", day: "numeric", month: "long" })}
                    </div>
                    <div className="grid g-4" style={{ gap: 8 }}>
                      {slots.map((s) => (
                        <button key={s.iso} type="button" className="btn sm ghost" style={{ justifyContent: "center" }} onClick={() => setSelected(s.iso)}>
                          {s.timeLabel}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
            </>
          ) : (
            <>
              <h2 style={{ fontSize: 20 }}>Datele tale</h2>
              <p style={{ marginBottom: 18 }}>
                Ai ales{" "}
                <b style={{ color: "var(--text)" }}>
                  {new Date(selected).toLocaleDateString("ro-RO", { weekday: "long", day: "numeric", month: "long" })}
                  , {new Date(selected).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })}
                </b>
                . <button type="button" onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: "var(--accent-2)", cursor: "pointer", fontSize: 12.5 }}>Schimbă</button>
              </p>
              <form onSubmit={handleSubmit}>
                <div className="field">
                  <label>Nume</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Numele tău" />
                </div>
                <div className="field">
                  <label>Email</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@afacere.ro" />
                </div>
                <div className="field">
                  <label>Telefon (opțional)</label>
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07xx xxx xxx" />
                </div>
                {error && <div className="field-error">{error}</div>}
                <button type="submit" className="btn primary" style={{ width: "100%", justifyContent: "center" }} disabled={submitting}>
                  {submitting ? "Se confirmă…" : "Confirmă programarea"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const TZ = "Europe/Bucharest";
const WD = ["Lun", "Mar", "Mie", "Joi", "Vin", "Sâm", "Dum"];
const MONTHS = ["ianuarie", "februarie", "martie", "aprilie", "mai", "iunie", "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie"];

// YYYY-MM-DD of an instant as seen in Romania, regardless of the visitor's own timezone.
const dayKey = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: TZ });
const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString("ro-RO", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const pad = (n: number) => String(n).padStart(2, "0");

// Pure calendar-date arithmetic on YYYY-MM-DD strings (no timezone involved).
function addDays(key: string, n: number) {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}
function mondayOf(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  const dow = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
  return addDays(key, -dow);
}
const dayNum = (key: string) => Number(key.slice(8, 10));
const monthName = (key: string) => MONTHS[Number(key.slice(5, 7)) - 1];
const dowIndex = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
};

export default function PublicBooking({ slug }: { slug: string | null }) {
  const supabase = createClient();
  const today = dayKey(new Date());
  const thisMonday = mondayOf(today);
  const [hostMissing, setHostMissing] = useState(false);
  const [weekStart, setWeekStart] = useState(thisMonday);
  const [slots, setSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickedDay, setPickedDay] = useState<string | null>(null);
  const [pickedSlot, setPickedSlot] = useState<string | null>(null);
  const [step, setStep] = useState<"pick" | "details" | "done">("pick");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assigned, setAssigned] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    supabase.rpc("get_booking_host", { p_slug: slug }).then(({ data }) => {
      if (!data || data.length === 0) setHostMissing(true);
    });
  }, [slug, supabase]);

  const weekEnd = addDays(weekStart, 6);

  useEffect(() => {
    let cancelled = false;
    supabase.rpc("list_available_slots", { p_slug: slug as string, p_from: weekStart, p_to: weekEnd }).then(({ data }) => {
      if (cancelled) return;
      setSlots((data ?? []).map((r) => r.slot));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [slug, weekStart, weekEnd, supabase]);

  const byDay = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const s of slots) {
      const k = dayKey(new Date(s));
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(s);
    }
    return map;
  }, [slots]);

  // Mon–Fri always; Saturday/Sunday only when somebody is actually free then.
  const visibleDays = useMemo(() => {
    const all = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    return all.filter((k) => dowIndex(k) < 5 || byDay.has(k));
  }, [weekStart, byDay]);

  function goWeek(delta: number) {
    setLoading(true);
    setPickedDay(null);
    setPickedSlot(null);
    setWeekStart((w) => addDays(w, delta * 7));
  }

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
    setAssigned((data as { assigned_name: string }).assigned_name);
    setStep("done");
  }

  if (hostMissing) {
    return (
      <div className="pb-page">
        <div className="pb-card" style={{ maxWidth: 460, textAlign: "center" }}>
          <h1 style={{ fontSize: 22 }}>Link invalid</h1>
          <p className="pb-msg" style={{ marginTop: 8 }}>Acest link de programare nu există sau nu mai este activ.</p>
        </div>
      </div>
    );
  }

  const pickedLabel = pickedDay && pickedSlot ? `${dayNum(pickedDay)} ${monthName(pickedDay)}, ${timeLabel(pickedSlot)}` : null;

  return (
    <div className="pb-page">
      <div className="pb-card">
        <div className="pb-top">
          <div>
            <small>Programare</small>
            <h1>Apel de strategie</h1>
            <p>20 de minute · Ora României</p>
          </div>
          {step === "pick" && (
            <div className="pb-weeknav">
              <button onClick={() => goWeek(-1)} disabled={weekStart <= thisMonday} aria-label="Săptămâna anterioară">‹</button>
              <span>
                {dayNum(weekStart)} {weekStart.slice(5, 7) !== weekEnd.slice(5, 7) ? monthName(weekStart) + " " : ""}– {dayNum(weekEnd)} {monthName(weekEnd)}
              </span>
              <button onClick={() => goWeek(1)} aria-label="Săptămâna următoare">›</button>
            </div>
          )}
        </div>

        {step === "pick" && (
          <>
            <div className="pb-days">
              {visibleDays.map((k) => {
                const n = byDay.get(k)?.length ?? 0;
                return (
                  <button
                    key={k}
                    type="button"
                    disabled={n === 0}
                    className={`pb-day${pickedDay === k ? " sel" : ""}`}
                    onClick={() => { setPickedDay(k); setPickedSlot(null); }}
                  >
                    <span>{WD[dowIndex(k)]}</span>
                    <b>{dayNum(k)}</b>
                    <em>{loading ? "…" : n > 0 ? `${n} ore libere` : "ocupat"}</em>
                  </button>
                );
              })}
            </div>

            <div className="pb-hours">
              {pickedDay &&
                (byDay.get(pickedDay) ?? []).map((s) => (
                  <button key={s} type="button" className={`pb-hour${pickedSlot === s ? " sel" : ""}`} onClick={() => setPickedSlot(s)}>
                    {timeLabel(s)}
                  </button>
                ))}
              {!loading && byDay.size === 0 && <p className="pb-msg">Nu sunt intervale libere în această săptămână — încearcă săptămâna următoare.</p>}
            </div>

            <div className="pb-cta">
              <button className="pb-go" disabled={!pickedSlot} onClick={() => setStep("details")}>Continuă</button>
              <span className="pb-msg">
                {pickedLabel ? (
                  <>
                    <span className="pb-dot">●</span> {pickedLabel}
                  </>
                ) : (
                  "Alege o zi și o oră."
                )}
              </span>
            </div>
          </>
        )}

        {step === "details" && (
          <form className="pb-form" onSubmit={handleSubmit}>
            <p className="pb-msg"><span className="pb-dot">●</span> {pickedLabel}</p>
            <label>Nume</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Numele tău" autoFocus />
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@afacere.ro" />
            <label>Telefon</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07xx xxx xxx" />
            {error && <div className="pb-err">{error}</div>}
            <div className="pb-cta">
              <button type="button" className="pb-ghost" onClick={() => { setStep("pick"); setError(null); }}>Înapoi</button>
              <button type="submit" className="pb-go" disabled={submitting}>{submitting ? "Se confirmă…" : "Confirmă programarea"}</button>
            </div>
          </form>
        )}

        {step === "done" && (
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 600 }}>Programare confirmată</h2>
            <p className="pb-msg" style={{ marginTop: 10, fontSize: 15 }}>
              Ne vedem pe <b style={{ color: "#fff" }}>{pickedLabel}</b>
              {assigned ? <>, cu <b style={{ color: "#fff" }}>{assigned}</b></> : null}. Echipa Creative C a fost anunțată.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

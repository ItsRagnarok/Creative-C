"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Owner } from "@/components/PipelineBoard";
import type { Enums } from "@/lib/supabase/database.types";

type BookingStatus = Enums<"booking_status">;

export type BookingRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  scheduled_at: string;
  duration_minutes: number;
  status: BookingStatus;
  notes: string | null;
  owner_id: string | null;
  owner: Owner | null;
};

type FormState = {
  id?: string;
  name: string;
  email: string;
  date: string;
  time: string;
  duration_minutes: string;
  owner_id: string;
  notes: string;
};

const DAY_LABELS = ["Luni", "Marți", "Miercuri", "Joi", "Vineri"];

function startOfWeek(base: Date) {
  const d = new Date(base);
  const isoDay = (d.getDay() + 6) % 7; // Mon=0..Sun=6
  d.setDate(d.getDate() - isoDay);
  d.setHours(0, 0, 0, 0);
  return d;
}

function emptyForm(owners: Owner[], defaultDate: Date): FormState {
  return {
    name: "",
    email: "",
    date: defaultDate.toISOString().slice(0, 10),
    time: "10:00",
    duration_minutes: "20",
    owner_id: owners[0]?.id ?? "",
    notes: "",
  };
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" });
}

export default function BookingsBoard({
  initialBookings,
  owners,
  canDelete,
}: {
  initialBookings: BookingRow[];
  owners: Owner[];
  canDelete: boolean;
}) {
  const supabase = createClient();
  const [bookings, setBookings] = useState(initialBookings);
  const [modal, setModal] = useState<null | { mode: "create" | "edit"; form: FormState }>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);

  // Fixed once at mount — every downstream calculation derives from this
  // instead of calling `new Date()` again during render.
  const [today] = useState(() => new Date());

  const weekStart = useMemo(() => {
    const base = new Date(today);
    base.setDate(base.getDate() + weekOffset * 7);
    return startOfWeek(base);
  }, [today, weekOffset]);

  const days = useMemo(
    () => Array.from({ length: 5 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    }),
    [weekStart],
  );

  const rangeLabel = `${days[0].toLocaleDateString("ro-RO", { day: "numeric", month: "long" })} – ${days[4].toLocaleDateString("ro-RO", { day: "numeric", month: "long", year: "numeric" })}`;

  const weekEnd = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 5);
    return d;
  }, [weekStart]);

  const activeBookings = useMemo(() => bookings.filter((b) => b.status === "confirmat"), [bookings]);

  const bookingsByDay = useMemo(() => {
    const map = new Map<number, BookingRow[]>();
    activeBookings.forEach((b) => {
      const dt = new Date(b.scheduled_at);
      if (dt < weekStart || dt >= weekEnd) return;
      const dayIndex = Math.floor((dt.getTime() - weekStart.getTime()) / 86_400_000);
      if (dayIndex < 0 || dayIndex > 4) return;
      if (!map.has(dayIndex)) map.set(dayIndex, []);
      map.get(dayIndex)!.push(b);
    });
    map.forEach((arr) => arr.sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at)));
    return map;
  }, [activeBookings, weekStart, weekEnd]);

  const kpis = useMemo(() => {
    const thisWeekCount = Array.from(bookingsByDay.values()).reduce((sum, arr) => sum + arr.length, 0);
    const upcoming = activeBookings
      .filter((b) => new Date(b.scheduled_at) >= today)
      .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
    const next = upcoming[0] ?? null;
    const fromPublicPage = upcoming.filter((b) => b.notes === "Rezervat din pagina publică").length;
    return { thisWeekCount, next, fromPublicPage };
  }, [activeBookings, bookingsByDay, today]);

  function openCreate(defaultDate?: Date) {
    setError(null);
    setModal({ mode: "create", form: emptyForm(owners, defaultDate ?? days[0]) });
  }

  function openEdit(b: BookingRow) {
    setError(null);
    const dt = new Date(b.scheduled_at);
    setModal({
      mode: "edit",
      form: {
        id: b.id,
        name: b.name,
        email: b.email ?? "",
        date: dt.toISOString().slice(0, 10),
        time: dt.toTimeString().slice(0, 5),
        duration_minutes: String(b.duration_minutes),
        owner_id: b.owner_id ?? "",
        notes: b.notes ?? "",
      },
    });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!modal) return;
    const { form, mode } = modal;
    if (!form.name.trim()) {
      setError("Numele e obligatoriu.");
      return;
    }
    const scheduled_at = new Date(`${form.date}T${form.time}:00`).toISOString();
    setSaving(true);
    setError(null);

    const payload = {
      name: form.name.trim(),
      email: form.email.trim() || null,
      scheduled_at,
      duration_minutes: Number(form.duration_minutes) || 20,
      owner_id: form.owner_id || null,
      notes: form.notes.trim() || null,
    };

    if (mode === "create") {
      const { data, error: err } = await supabase
        .from("bookings")
        .insert(payload)
        .select("*, owner:profiles(id, full_name, initials)")
        .single();
      setSaving(false);
      if (err) return setError(err.message);
      setBookings((prev) => [...prev, data as BookingRow]);
    } else {
      const { data, error: err } = await supabase
        .from("bookings")
        .update(payload)
        .eq("id", form.id!)
        .select("*, owner:profiles(id, full_name, initials)")
        .single();
      setSaving(false);
      if (err) return setError(err.message);
      setBookings((prev) => prev.map((b) => (b.id === form.id ? (data as BookingRow) : b)));
    }
    setModal(null);
  }

  async function handleCancel() {
    if (!modal?.form.id) return;
    setSaving(true);
    const { error: err } = await supabase.from("bookings").update({ status: "anulat" }).eq("id", modal.form.id);
    setSaving(false);
    if (err) return setError(err.message);
    setBookings((prev) => prev.map((b) => (b.id === modal.form.id ? { ...b, status: "anulat" } : b)));
    setModal(null);
  }

  async function handleDelete() {
    if (!modal?.form.id) return;
    if (!window.confirm("Ștergi definitiv această programare?")) return;
    setSaving(true);
    const { error: err } = await supabase.from("bookings").delete().eq("id", modal.form.id);
    setSaving(false);
    if (err) return setError(err.message);
    setBookings((prev) => prev.filter((b) => b.id !== modal.form.id));
    setModal(null);
  }

  async function copyPublicLink() {
    const url = `${window.location.origin}/programeaza`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // clipboard API can be blocked — the button below still shows the link
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Programări</h1>
          <p>Toate apelurile programate — cele rezervate public intră automat și în Pipeline.</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" className="btn ghost" onClick={copyPublicLink}>Copiază link public de booking</button>
          <button className="btn primary" onClick={() => openCreate()}>+ Programare</button>
        </div>
      </div>

      <div className="grid g-3" style={{ marginBottom: 18 }}>
        <div className="card kpi">
          <div className="label">Programări săptămâna afișată</div>
          <div className="value">{kpis.thisWeekCount}</div>
          <div className="delta up">confirmate, fără cele anulate</div>
        </div>
        <div className="card kpi">
          <div className="label">Următorul apel</div>
          <div className="value" style={{ fontSize: 18 }}>
            {kpis.next ? new Date(kpis.next.scheduled_at).toLocaleDateString("ro-RO", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
          </div>
          <div className="delta up">{kpis.next ? kpis.next.name : "niciunul programat"}</div>
        </div>
        <div className="card kpi">
          <div className="label">Din pagina publică</div>
          <div className="value">{kpis.fromPublicPage}</div>
          <div className="delta up">rezervate direct de lead-uri, viitoare</div>
        </div>
      </div>

      <div className="card" style={{ padding: 18 }}>
        <div className="cal-toolbar">
          <div>
            <div className="cal-range">Săptămâna {rangeLabel}</div>
            <div className="faint" style={{ fontSize: 11 }}>sincronizat cu Google Calendar</div>
          </div>
          <div className="cal-nav-btns">
            <button className="btn sm ghost" onClick={() => setWeekOffset((w) => w - 1)}>← Săpt. trecută</button>
            <button className="btn sm ghost" onClick={() => setWeekOffset(0)}>Azi</button>
            <button className="btn sm ghost" onClick={() => setWeekOffset((w) => w + 1)}>Săpt. următoare →</button>
          </div>
        </div>

        <div className="cal-cols">
          {days.map((d, dayIndex) => {
            const isToday = d.toDateString() === today.toDateString();
            const items = bookingsByDay.get(dayIndex) ?? [];
            return (
              <div key={dayIndex} className="cal-col">
                <div className={`cal-col-head ${isToday ? "today" : ""}`}>
                  {DAY_LABELS[dayIndex]}
                  <span className="faint" style={{ fontWeight: 500 }}>
                    {" "}{d.toLocaleDateString("ro-RO", { day: "numeric", month: "short" })}
                  </span>
                </div>
                {items.length === 0 && (
                  <div className="cal-col-empty">
                    liber toată ziua
                    <button className="cal-add-btn" onClick={() => openCreate(d)} title="Adaugă programare">+</button>
                  </div>
                )}
                {items.map((b) => {
                  const isNew = b.notes === "Rezervat din pagina publică";
                  return (
                    <button key={b.id} className={`cal-card ${isNew ? "new" : ""}`} onClick={() => openEdit(b)}>
                      {isNew && <span className="cal-new-tag">NOU</span>}
                      <span className="t">{fmtTime(b.scheduled_at)}</span>
                      <span className="n">{b.owner ? `${b.owner.initials} — ` : ""}{b.name}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <div className="section-title"><h2>Reguli de sincronizare</h2></div>
      <div className="grid g-3">
        <div className="card">
          <h3 style={{ fontSize: 13.5 }}>Fără suprapuneri</h3>
          <p style={{ fontSize: 12 }}>Un interval deja rezervat dispare automat din pagina publică de booking.</p>
        </div>
        <div className="card">
          <h3 style={{ fontSize: 13.5 }}>Lead automat</h3>
          <p style={{ fontSize: 12 }}>Orice rezervare din pagina publică creează automat un card „Nou” în Pipeline.</p>
        </div>
        <div className="card">
          <h3 style={{ fontSize: 13.5 }}>Notificare echipă</h3>
          <p style={{ fontSize: 12 }}>La fiecare rezervare nouă, toată echipa primește o notificare (clopoțel).</p>
        </div>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{modal.mode === "create" ? "Programare nouă" : "Editează programare"}</h3>
              <button className="modal-close" onClick={() => setModal(null)}>✕</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="field">
                <label>Nume</label>
                <input value={modal.form.name} onChange={(e) => setModal({ ...modal, form: { ...modal.form, name: e.target.value } })} />
              </div>
              <div className="field">
                <label>Email (opțional)</label>
                <input type="email" value={modal.form.email} onChange={(e) => setModal({ ...modal, form: { ...modal.form, email: e.target.value } })} />
              </div>
              <div className="grid g-2">
                <div className="field">
                  <label>Data</label>
                  <input type="date" value={modal.form.date} onChange={(e) => setModal({ ...modal, form: { ...modal.form, date: e.target.value } })} />
                </div>
                <div className="field">
                  <label>Ora</label>
                  <input type="time" value={modal.form.time} onChange={(e) => setModal({ ...modal, form: { ...modal.form, time: e.target.value } })} />
                </div>
              </div>
              <div className="grid g-2">
                <div className="field">
                  <label>Durată (min)</label>
                  <input type="number" min="10" step="10" value={modal.form.duration_minutes} onChange={(e) => setModal({ ...modal, form: { ...modal.form, duration_minutes: e.target.value } })} />
                </div>
                <div className="field">
                  <label>Cu cine</label>
                  <select value={modal.form.owner_id} onChange={(e) => setModal({ ...modal, form: { ...modal.form, owner_id: e.target.value } })}>
                    <option value="">— nealocat —</option>
                    {owners.map((o) => (
                      <option key={o.id} value={o.id}>{o.full_name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="field">
                <label>Notițe</label>
                <textarea rows={2} value={modal.form.notes} onChange={(e) => setModal({ ...modal, form: { ...modal.form, notes: e.target.value } })} />
              </div>

              {error && <div className="field-error">{error}</div>}

              <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
                {modal.mode === "edit" && (
                  <button type="button" className="btn ghost" onClick={handleCancel} disabled={saving}>
                    Anulează programarea
                  </button>
                )}
                {modal.mode === "edit" && canDelete && (
                  <button type="button" className="btn danger" onClick={handleDelete} disabled={saving}>
                    Șterge
                  </button>
                )}
                <button type="submit" className="btn primary" style={{ flex: 1, justifyContent: "center" }} disabled={saving}>
                  {saving ? "Se salvează…" : "Salvează"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

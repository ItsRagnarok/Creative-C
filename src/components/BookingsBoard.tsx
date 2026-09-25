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

function emptyForm(owners: Owner[]): FormState {
  const now = new Date();
  now.setDate(now.getDate() + 1);
  return {
    name: "",
    email: "",
    date: now.toISOString().slice(0, 10),
    time: "10:00",
    duration_minutes: "20",
    owner_id: owners[0]?.id ?? "",
    notes: "",
  };
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("ro-RO", { weekday: "long", day: "numeric", month: "long" });
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

  const grouped = useMemo(() => {
    const active = bookings.filter((b) => b.status === "confirmat");
    const byDay = new Map<string, BookingRow[]>();
    active
      .slice()
      .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
      .forEach((b) => {
        const key = new Date(b.scheduled_at).toDateString();
        if (!byDay.has(key)) byDay.set(key, []);
        byDay.get(key)!.push(b);
      });
    return Array.from(byDay.entries());
  }, [bookings]);

  function openCreate() {
    setError(null);
    setModal({ mode: "create", form: emptyForm(owners) });
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

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Programări</h1>
          <p>Toate apelurile programate — cele rezervate public intră automat și în Pipeline.</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <a href="/programeaza" target="_blank" rel="noreferrer" className="btn ghost">
            Vezi pagina publică ↗
          </a>
          <button className="btn primary" onClick={openCreate}>+ Programare</button>
        </div>
      </div>

      <div className="card">
        {grouped.length === 0 && <div className="empty-note">Nicio programare activă momentan.</div>}
        {grouped.map(([day, items]) => (
          <div key={day} style={{ marginBottom: 22 }}>
            <div className="nav-label" style={{ padding: "0 4px 8px", textTransform: "capitalize" }}>
              {fmtDate(items[0].scheduled_at)}
            </div>
            <div className="list">
              {items.map((b) => (
                <div key={b.id} className="list-row" style={{ cursor: "pointer" }} onClick={() => openEdit(b)}>
                  <span className="tag mono">{fmtTime(b.scheduled_at)}</span>
                  <div style={{ flex: 1 }}>
                    <div className="p-name">{b.name}</div>
                    {b.notes && <div className="p-sub">{b.notes}</div>}
                  </div>
                  {b.owner && (
                    <div className="p-avatar" style={{ width: 26, height: 26, fontSize: 10 }}>{b.owner.initials}</div>
                  )}
                  <span className="faint" style={{ fontSize: 11.5 }}>{b.duration_minutes} min</span>
                </div>
              ))}
            </div>
          </div>
        ))}
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

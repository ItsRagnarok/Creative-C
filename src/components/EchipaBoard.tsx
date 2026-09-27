"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ROLE_LABEL, type AppRole } from "@/lib/roles";

export type ProfileRow = {
  id: string;
  full_name: string;
  initials: string;
  role: AppRole;
  created_at: string;
};

const ROLE_BADGE: Record<AppRole, string> = {
  admin: "violet",
  manager: "blue",
  vanzari: "green",
  editor: "amber",
};

const CONFIRM_WORD = "STERGE";

function monthYear(iso: string) {
  return new Date(iso).toLocaleDateString("ro-RO", { month: "long", year: "numeric" });
}

type InviteForm = { full_name: string; initials: string; email: string; password: string; role: AppRole };
type EditForm = { id: string; full_name: string; initials: string; role: AppRole };

function emptyInvite(): InviteForm {
  return { full_name: "", initials: "", email: "", password: "", role: "editor" };
}

export default function EchipaBoard({
  initialProfiles,
  canManage,
  currentUserId,
}: {
  initialProfiles: ProfileRow[];
  canManage: boolean;
  currentUserId: string;
}) {
  const supabase = createClient();
  const [profiles, setProfiles] = useState(initialProfiles);
  const [inviteModal, setInviteModal] = useState<InviteForm | null>(null);
  const [editModal, setEditModal] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmIds, setConfirmIds] = useState<string[] | null>(null);
  const [confirmStep, setConfirmStep] = useState<1 | 2>(1);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteModal) return;
    if (!inviteModal.full_name.trim() || !inviteModal.email.trim() || !inviteModal.initials.trim()) {
      setError("Completează numele, inițialele și emailul.");
      return;
    }
    if (inviteModal.password.length < 8) {
      setError("Parola trebuie să aibă minim 8 caractere.");
      return;
    }
    setSaving(true);
    setError(null);
    const { data, error: err } = await supabase.functions.invoke("invite-team-member", {
      body: {
        full_name: inviteModal.full_name.trim(),
        initials: inviteModal.initials.trim().toUpperCase().slice(0, 2),
        email: inviteModal.email.trim(),
        password: inviteModal.password,
        role: inviteModal.role,
      },
    });
    setSaving(false);
    if (err || !data?.profile) {
      setError(data?.error ?? err?.message ?? "Nu am putut adăuga membrul.");
      return;
    }
    setProfiles((prev) => [...prev, data.profile as ProfileRow]);
    setInviteModal(null);
  }

  function openEdit(p: ProfileRow) {
    setError(null);
    setEditModal({ id: p.id, full_name: p.full_name, initials: p.initials, role: p.role });
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editModal) return;
    if (!editModal.full_name.trim() || !editModal.initials.trim()) {
      setError("Numele și inițialele sunt obligatorii.");
      return;
    }
    setSaving(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("profiles")
      .update({
        full_name: editModal.full_name.trim(),
        initials: editModal.initials.trim().toUpperCase().slice(0, 2),
        role: editModal.role,
      })
      .eq("id", editModal.id)
      .select("*")
      .single();
    setSaving(false);
    if (err) return setError(err.message);
    setProfiles((prev) => prev.map((p) => (p.id === editModal.id ? (data as ProfileRow) : p)));
    setEditModal(null);
  }

  function openConfirm(ids: string[]) {
    setDeleteError(null);
    setConfirmStep(1);
    setConfirmText("");
    setConfirmIds(ids);
  }

  function closeConfirm() {
    setConfirmIds(null);
    setConfirmStep(1);
    setConfirmText("");
    setDeleteError(null);
  }

  async function handleConfirmedDelete() {
    if (!confirmIds) return;
    setDeleting(true);
    setDeleteError(null);
    const failures: string[] = [];
    for (const id of confirmIds) {
      const { data, error: err } = await supabase.functions.invoke("delete-team-member", { body: { user_id: id } });
      if (err || !data?.ok) failures.push(data?.error ?? err?.message ?? "eroare necunoscută");
    }
    setDeleting(false);
    if (failures.length) {
      setDeleteError(failures[0]);
      return;
    }
    const idSet = new Set(confirmIds);
    setProfiles((prev) => prev.filter((p) => !idSet.has(p.id)));
    setSelected((prev) => {
      const next = new Set(prev);
      confirmIds.forEach((id) => next.delete(id));
      return next;
    });
    closeConfirm();
  }

  const confirmTargets = confirmIds ? profiles.filter((p) => confirmIds.includes(p.id)) : [];
  const deletableSelected = Array.from(selected).filter((id) => id !== currentUserId);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Echipă</h1>
          <p>{profiles.length} membri · roluri și acces în platformă.</p>
        </div>
        {canManage && (
          <button className="btn primary" onClick={() => { setError(null); setInviteModal(emptyInvite()); }}>
            + Membru nou
          </button>
        )}
      </div>

      {canManage && deletableSelected.length > 0 && (
        <div className="card" style={{ marginBottom: 18, padding: "12px 18px", display: "flex", alignItems: "center", gap: 12 }}>
          <span className="tag">{deletableSelected.length} selectați</span>
          <button type="button" className="btn ghost sm" onClick={() => setSelected(new Set())}>Anulează selecția</button>
          <button
            type="button"
            className="btn danger sm"
            style={{ marginLeft: "auto" }}
            onClick={() => openConfirm(deletableSelected)}
          >
            Șterge selectații
          </button>
        </div>
      )}

      <div className="card" style={{ padding: 0 }}>
        <table className="table">
          <thead>
            <tr>
              {canManage && <th style={{ width: 34 }} />}
              <th>Membru</th>
              <th>Rol</th>
              <th>Membru din</th>
              {canManage && <th style={{ width: 44 }} />}
            </tr>
          </thead>
          <tbody>
            {profiles.map((p) => (
              <tr key={p.id}>
                {canManage && (
                  <td>
                    {p.id !== currentUserId && (
                      <input
                        type="checkbox"
                        checked={selected.has(p.id)}
                        onChange={() => toggleSelected(p.id)}
                        aria-label={`Selectează ${p.full_name}`}
                      />
                    )}
                  </td>
                )}
                <td>
                  <div className="person">
                    <div className="p-avatar">{p.initials}</div>
                    <div>
                      <div className="p-name">
                        {p.full_name}
                        {p.id === currentUserId && <span className="faint" style={{ fontWeight: 500 }}> (tu)</span>}
                      </div>
                    </div>
                  </div>
                </td>
                <td><span className={`badge ${ROLE_BADGE[p.role]}`}>{ROLE_LABEL[p.role]}</span></td>
                <td className="faint">{monthYear(p.created_at)}</td>
                {canManage && (
                  <td>
                    <button type="button" className="icon-btn" style={{ width: 28, height: 28 }} title="Editează" onClick={() => openEdit(p)}>
                      ✎
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {inviteModal && (
        <div className="modal-overlay" onClick={() => setInviteModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Membru nou</h3>
              <button className="modal-close" onClick={() => setInviteModal(null)}>✕</button>
            </div>
            <form onSubmit={handleInvite}>
              <div className="field">
                <label>Nume complet</label>
                <input value={inviteModal.full_name} onChange={(e) => setInviteModal({ ...inviteModal, full_name: e.target.value })} />
              </div>
              <div className="grid g-2">
                <div className="field">
                  <label>Inițiale</label>
                  <input value={inviteModal.initials} maxLength={2} onChange={(e) => setInviteModal({ ...inviteModal, initials: e.target.value })} />
                </div>
                <div className="field">
                  <label>Rol</label>
                  <select value={inviteModal.role} onChange={(e) => setInviteModal({ ...inviteModal, role: e.target.value as AppRole })}>
                    {(Object.keys(ROLE_LABEL) as AppRole[]).map((r) => (
                      <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="field">
                <label>Email de lucru</label>
                <input type="email" value={inviteModal.email} onChange={(e) => setInviteModal({ ...inviteModal, email: e.target.value })} />
              </div>
              <div className="field">
                <label>Parolă inițială</label>
                <input type="password" value={inviteModal.password} onChange={(e) => setInviteModal({ ...inviteModal, password: e.target.value })} placeholder="minim 8 caractere" />
              </div>

              {error && <div className="field-error">{error}</div>}

              <button type="submit" className="btn primary" style={{ width: "100%", justifyContent: "center", marginTop: 6 }} disabled={saving}>
                {saving ? "Se creează…" : "Adaugă membru"}
              </button>
            </form>
          </div>
        </div>
      )}

      {editModal && (
        <div className="modal-overlay" onClick={() => setEditModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Editează membru</h3>
              <button className="modal-close" onClick={() => setEditModal(null)}>✕</button>
            </div>
            <form onSubmit={handleEditSave}>
              <div className="field">
                <label>Nume complet</label>
                <input value={editModal.full_name} onChange={(e) => setEditModal({ ...editModal, full_name: e.target.value })} />
              </div>
              <div className="grid g-2">
                <div className="field">
                  <label>Inițiale</label>
                  <input value={editModal.initials} maxLength={2} onChange={(e) => setEditModal({ ...editModal, initials: e.target.value })} />
                </div>
                <div className="field">
                  <label>Rol</label>
                  <select
                    value={editModal.role}
                    disabled={editModal.id === currentUserId}
                    onChange={(e) => setEditModal({ ...editModal, role: e.target.value as AppRole })}
                  >
                    {(Object.keys(ROLE_LABEL) as AppRole[]).map((r) => (
                      <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                    ))}
                  </select>
                </div>
              </div>
              {editModal.id === currentUserId && (
                <div className="empty-note" style={{ marginBottom: 14, textAlign: "left" }}>Nu îți poți schimba singur rolul.</div>
              )}

              {error && <div className="field-error">{error}</div>}

              <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
                {editModal.id !== currentUserId && (
                  <button type="button" className="btn danger" onClick={() => { setEditModal(null); openConfirm([editModal.id]); }} disabled={saving}>
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

      {confirmIds && (
        <div className="modal-overlay" onClick={closeConfirm}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Șterge {confirmIds.length > 1 ? `${confirmIds.length} membri` : "membru"}</h3>
              <button className="modal-close" onClick={closeConfirm}>✕</button>
            </div>

            {confirmStep === 1 ? (
              <>
                <p style={{ marginBottom: 4 }}>
                  Sigur vrei să ștergi {confirmIds.length > 1 ? "acești membri" : "acest membru"}?
                </p>
                <div className="list" style={{ marginBottom: 14, maxHeight: 160, overflowY: "auto" }}>
                  {confirmTargets.map((p) => (
                    <div key={p.id} className="list-row" style={{ padding: "8px 4px" }}>
                      <span className="p-name" style={{ fontSize: 13 }}>{p.full_name}</span>
                    </div>
                  ))}
                </div>
                <div className="field-error" style={{ marginBottom: 14 }}>
                  Acțiunea este ireversibilă — contul de autentificare este șters definitiv.
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button type="button" className="btn ghost" style={{ flex: 1, justifyContent: "center" }} onClick={closeConfirm}>
                    Renunță
                  </button>
                  <button type="button" className="btn danger" style={{ flex: 1, justifyContent: "center" }} onClick={() => setConfirmStep(2)}>
                    Continuă
                  </button>
                </div>
              </>
            ) : (
              <>
                <p style={{ marginBottom: 12 }}>
                  Ultima confirmare: scrie <b style={{ color: "var(--text)" }}>{CONFIRM_WORD}</b> ca să ștergi definitiv
                  {confirmIds.length > 1 ? ` cei ${confirmIds.length} membri` : " acest membru"}.
                </p>
                <div className="field">
                  <input autoFocus value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder={CONFIRM_WORD} />
                </div>
                {deleteError && <div className="field-error">{deleteError}</div>}
                <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
                  <button type="button" className="btn ghost" style={{ flex: 1, justifyContent: "center" }} onClick={() => setConfirmStep(1)} disabled={deleting}>
                    Înapoi
                  </button>
                  <button
                    type="button"
                    className="btn danger"
                    style={{ flex: 1, justifyContent: "center" }}
                    disabled={deleting || confirmText.trim().toUpperCase() !== CONFIRM_WORD}
                    onClick={handleConfirmedDelete}
                  >
                    {deleting ? "Se șterge…" : "Șterge definitiv"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

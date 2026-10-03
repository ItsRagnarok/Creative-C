"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { functionErrorMessage } from "@/lib/supabase/functionError";
import { ROLE_LABEL, ROLE_NOTE, type AppRole } from "@/lib/roles";

export type ProfileRow = {
  id: string;
  full_name: string;
  initials: string;
  role: AppRole;
  is_super_admin?: boolean;
  created_at: string;
};

const ROLE_BADGE: Record<AppRole, string> = {
  admin: "violet",
  manager: "blue",
  vanzari: "green",
  editor: "amber",
};

const CONFIRM_WORD = "STERGE";

// Any admin may create manager / editor / closer accounts; only admin S may create or re-role admins.
const BASE_ROLES: AppRole[] = ["manager", "vanzari", "editor"];

// Team order: admin S, admins, managers, editors, closers (oldest first within a group).
const ROLE_RANK: Record<AppRole, number> = { admin: 1, manager: 2, editor: 3, vanzari: 4 };
const rank = (p: ProfileRow) => (p.is_super_admin ? 0 : ROLE_RANK[p.role]);

function monthYear(iso: string) {
  return new Date(iso).toLocaleDateString("ro-RO", { month: "long", year: "numeric" });
}

type InviteForm = { full_name: string; email: string; password: string; role: AppRole };
type EditForm = { id: string; full_name: string; role: AppRole; newPassword: string; email: string };

function emptyInvite(): InviteForm {
  return { full_name: "", email: "", password: "", role: "editor" };
}

// Initials are derived from the name so nobody has to type them.
function makeInitials(name: string) {
  const parts = name.trim().split(/[\s-]+/).filter(Boolean);
  if (parts.length === 0) return "";
  const first = parts[0][0];
  const second = parts.length > 1 ? parts[parts.length - 1][0] : parts[0][1] ?? "";
  return (first + second).toUpperCase();
}

function generatePassword() {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

export default function EchipaBoard({
  initialProfiles,
  canManage,
  currentIsSuper,
  currentUserId,
}: {
  initialProfiles: ProfileRow[];
  canManage: boolean;
  currentIsSuper: boolean;
  currentUserId: string;
}) {
  const assignableRoles: AppRole[] = currentIsSuper ? ["admin", ...BASE_ROLES] : BASE_ROLES;
  // A plain admin can neither edit nor delete another admin; admin S is untouchable.
  const canTouch = (p: ProfileRow) => canManage && !p.is_super_admin && (p.role !== "admin" || currentIsSuper);
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
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!canManage) return;
    supabase.functions.invoke("manage-team-member", { body: { action: "emails" } }).then(({ data }) => {
      if (data?.emails) setEmails(data.emails);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage]);

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
    if (!inviteModal.full_name.trim() || !inviteModal.email.trim()) {
      setError("Completează numele și emailul.");
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
        initials: makeInitials(inviteModal.full_name),
        email: inviteModal.email.trim(),
        password: inviteModal.password,
        role: inviteModal.role,
      },
    });
    setSaving(false);
    if (err || !data?.profile) {
      setError(await functionErrorMessage(err ?? new Error(data?.error), "Nu am putut adăuga membrul."));
      return;
    }
    setProfiles((prev) => [...prev, data.profile as ProfileRow]);
    setEmails((prev) => ({ ...prev, [data.profile.id]: inviteModal.email.trim().toLowerCase() }));
    setNotice(`Cont creat pentru ${inviteModal.full_name.trim()}. Transmite-i emailul și parola inițială.`);
    setInviteModal(null);
  }

  function openEdit(p: ProfileRow) {
    setError(null);
    setEditModal({ id: p.id, full_name: p.full_name, role: p.role, newPassword: "", email: emails[p.id] ?? "" });
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editModal) return;
    if (!editModal.full_name.trim()) {
      setError("Numele este obligatoriu.");
      return;
    }
    if (editModal.newPassword && editModal.newPassword.length < 8) {
      setError("Parola nouă trebuie să aibă minim 8 caractere.");
      return;
    }
    setSaving(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("profiles")
      .update({
        full_name: editModal.full_name.trim(),
        initials: makeInitials(editModal.full_name),
        role: editModal.role,
      })
      .eq("id", editModal.id)
      .select("*")
      .single();
    if (err) {
      setSaving(false);
      return setError(err.message);
    }
    const newEmail = editModal.email.trim().toLowerCase();
    if (newEmail && newEmail !== (emails[editModal.id] ?? "")) {
      const { data: em, error: emErr } = await supabase.functions.invoke("manage-team-member", {
        body: { action: "set_email", user_id: editModal.id, email: newEmail },
      });
      if (emErr || !em?.ok) {
        setSaving(false);
        return setError(await functionErrorMessage(emErr ?? new Error(em?.error), "Datele au fost salvate, dar emailul nu a putut fi schimbat."));
      }
      setEmails((prev) => ({ ...prev, [editModal.id]: newEmail }));
      setNotice(`Emailul pentru ${editModal.full_name.trim()} este acum ${newEmail}. Cu el se loghează de acum.`);
    }
    if (editModal.newPassword) {
      const { data: pw, error: pwErr } = await supabase.functions.invoke("manage-team-member", {
        body: { action: "set_password", user_id: editModal.id, password: editModal.newPassword },
      });
      if (pwErr || !pw?.ok) {
        setSaving(false);
        return setError(await functionErrorMessage(pwErr ?? new Error(pw?.error), "Datele au fost salvate, dar parola nu a putut fi schimbată."));
      }
      setNotice(`Parola pentru ${editModal.full_name.trim()} a fost schimbată.`);
    }
    setSaving(false);
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
      if (err || !data?.ok) failures.push(await functionErrorMessage(err ?? new Error(data?.error), "eroare necunoscută"));
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

      {notice && (
        <div className="card" style={{ marginBottom: 18, padding: "12px 18px", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 13 }}>{notice}</span>
          <button type="button" className="btn ghost sm" style={{ marginLeft: "auto" }} onClick={() => setNotice(null)}>Închide</button>
        </div>
      )}

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
            {[...profiles].sort((x, y) => rank(x) - rank(y) || x.created_at.localeCompare(y.created_at)).map((p) => (
              <tr key={p.id}>
                {canManage && (
                  <td>
                    {p.id !== currentUserId && canTouch(p) && (
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
                      {emails[p.id] && <div className="faint" style={{ fontSize: 12 }}>{emails[p.id]}</div>}
                    </div>
                  </div>
                </td>
                <td><span className={`badge ${ROLE_BADGE[p.role]}`}>{p.is_super_admin ? "Admin S" : ROLE_LABEL[p.role]}</span></td>
                <td className="faint">{monthYear(p.created_at)}</td>
                {canManage && (
                  <td>
                    {(p.id === currentUserId || canTouch(p)) && (
                    <button type="button" className="icon-btn" style={{ width: 28, height: 28 }} title="Editează" onClick={() => openEdit(p)}>
                      ✎
                    </button>
                    )}
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
              <div className="field">
                <label>Email de lucru</label>
                <input type="email" value={inviteModal.email} onChange={(e) => setInviteModal({ ...inviteModal, email: e.target.value })} />
              </div>
              <div className="field">
                <label>Rol</label>
                <select value={inviteModal.role} onChange={(e) => setInviteModal({ ...inviteModal, role: e.target.value as AppRole })}>
                  {assignableRoles.map((r) => (
                    <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                  ))}
                </select>
                <div className="faint" style={{ fontSize: 12, marginTop: 4 }}>{ROLE_NOTE[inviteModal.role]}</div>
              </div>
              <div className="field">
                <label>Parolă inițială</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    style={{ flex: 1 }}
                    value={inviteModal.password}
                    onChange={(e) => setInviteModal({ ...inviteModal, password: e.target.value })}
                    placeholder="minim 8 caractere"
                  />
                  <button type="button" className="btn ghost sm" onClick={() => setInviteModal({ ...inviteModal, password: generatePassword() })}>
                    Generează
                  </button>
                </div>
                <div className="faint" style={{ fontSize: 12, marginTop: 4 }}>Persoana și-o poate schimba ulterior din contul ei.</div>
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
              <div className="field">
                <label>Email (cu el se loghează)</label>
                <input type="email" value={editModal.email} onChange={(e) => setEditModal({ ...editModal, email: e.target.value })} placeholder="nume@exemplu.ro" />
              </div>
              <div className="field">
                <label>Rol</label>
                <select
                  value={editModal.role}
                  disabled={editModal.id === currentUserId}
                  onChange={(e) => setEditModal({ ...editModal, role: e.target.value as AppRole })}
                >
                  {(editModal.role === "admin" ? (["admin", ...BASE_ROLES] as AppRole[]) : assignableRoles).map((r) => (
                    <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                  ))}
                </select>
                <div className="faint" style={{ fontSize: 12, marginTop: 4 }}>{ROLE_NOTE[editModal.role]}</div>
              </div>
              <div className="field">
                <label>Parolă nouă (opțional)</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    style={{ flex: 1 }}
                    value={editModal.newPassword}
                    onChange={(e) => setEditModal({ ...editModal, newPassword: e.target.value })}
                    placeholder="lasă gol ca să nu o schimbi"
                  />
                  <button type="button" className="btn ghost sm" onClick={() => setEditModal({ ...editModal, newPassword: generatePassword() })}>
                    Generează
                  </button>
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

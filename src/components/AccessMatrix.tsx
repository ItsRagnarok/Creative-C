"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { MENUS, roleDefault, type MenuKey } from "@/lib/access";
import { ROLE_LABEL, type AppRole } from "@/lib/roles";

export type AccessUser = { id: string; full_name: string; role: AppRole; is_super_admin: boolean };
export type AccessRow = { user_id: string; menu: string; can_view: boolean | null; can_edit: boolean | null };

type Cell = { view: boolean; edit: boolean };

function effective(user: AccessUser, rows: AccessRow[]): Record<MenuKey, Cell> {
  const out = {} as Record<MenuKey, Cell>;
  for (const m of MENUS) {
    const r = rows.find((x) => x.user_id === user.id && x.menu === m.key);
    out[m.key] = {
      view: r?.can_view ?? roleDefault(user.role, m.key, "view"),
      edit: r?.can_edit ?? roleDefault(user.role, m.key, "edit"),
    };
  }
  return out;
}

// Admin S ticks, per person, which menus they can see and in which they can make changes.
export default function AccessMatrix({ users, initialRows }: { users: AccessUser[]; initialRows: AccessRow[] }) {
  const supabase = createClient();
  const [rows, setRows] = useState(initialRows);
  const [userId, setUserId] = useState(users[0]?.id ?? "");
  const user = users.find((u) => u.id === userId) ?? null;
  const [draft, setDraft] = useState<Record<MenuKey, Cell> | null>(user ? effective(user, initialRows) : null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function pickUser(id: string) {
    setUserId(id);
    const u = users.find((x) => x.id === id);
    setDraft(u ? effective(u, rows) : null);
    setMsg(null);
  }

  function toggle(menu: MenuKey, kind: "view" | "edit", value: boolean) {
    setDraft((d) => {
      if (!d) return d;
      const cur = { ...d[menu] };
      if (kind === "view") {
        cur.view = value;
        if (!value) cur.edit = false; // no access to see => nothing to edit
      } else {
        cur.edit = value;
        if (value) cur.view = true;
      }
      return { ...d, [menu]: cur };
    });
    setMsg(null);
  }

  function resetToRole() {
    if (user) setDraft(Object.fromEntries(MENUS.map((m) => [m.key, { view: roleDefault(user.role, m.key, "view"), edit: roleDefault(user.role, m.key, "edit") }])) as Record<MenuKey, Cell>);
  }

  async function save() {
    if (!user || !draft) return;
    setSaving(true);
    setMsg(null);
    const upserts: AccessRow[] = [];
    const clears: string[] = [];
    for (const m of MENUS) {
      const dv = roleDefault(user.role, m.key, "view");
      const de = roleDefault(user.role, m.key, "edit");
      const can_view = draft[m.key].view === dv ? null : draft[m.key].view;
      const can_edit = draft[m.key].edit === de ? null : draft[m.key].edit;
      if (can_view === null && can_edit === null) clears.push(m.key);
      else upserts.push({ user_id: user.id, menu: m.key, can_view, can_edit });
    }
    if (clears.length > 0) {
      const { error } = await supabase.from("user_access").delete().eq("user_id", user.id).in("menu", clears);
      if (error) {
        setSaving(false);
        return setMsg(error.message);
      }
    }
    if (upserts.length > 0) {
      const { error } = await supabase.from("user_access").upsert(upserts, { onConflict: "user_id,menu" });
      if (error) {
        setSaving(false);
        return setMsg(error.message);
      }
    }
    setRows((prev) => [...prev.filter((r) => r.user_id !== user.id), ...upserts]);
    setSaving(false);
    setMsg("Accesul a fost salvat. Se aplică la următoarea încărcare a paginii pentru acel utilizator.");
  }

  if (users.length === 0) return <div className="empty-note">Niciun utilizator de configurat.</div>;

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
        <select value={userId} onChange={(e) => pickUser(e.target.value)}>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.full_name} — {ROLE_LABEL[u.role]}</option>
          ))}
        </select>
        <button type="button" className="btn sm ghost" onClick={resetToRole}>Revino la accesul rolului</button>
      </div>

      {user && draft && (
        <div style={{ overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th>Meniu</th>
                <th style={{ textAlign: "center" }}>Poate vedea</th>
                <th style={{ textAlign: "center" }}>Poate modifica</th>
                <th>Față de rol</th>
              </tr>
            </thead>
            <tbody>
              {MENUS.map((m) => {
                const dv = roleDefault(user.role, m.key, "view");
                const de = roleDefault(user.role, m.key, "edit");
                const changed = draft[m.key].view !== dv || draft[m.key].edit !== de;
                return (
                  <tr key={m.key}>
                    <td>{m.label}</td>
                    <td style={{ textAlign: "center" }}>
                      <input type="checkbox" checked={draft[m.key].view} onChange={(e) => toggle(m.key, "view", e.target.checked)} />
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <input type="checkbox" checked={draft[m.key].edit} onChange={(e) => toggle(m.key, "edit", e.target.checked)} />
                    </td>
                    <td>{changed ? <span className="badge amber">personalizat</span> : <span className="faint" style={{ fontSize: 12 }}>implicit</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14 }}>
        <button type="button" className="btn primary" onClick={save} disabled={saving || !user}>{saving ? "Se salvează…" : "Salvează accesul"}</button>
        {msg && <span className="faint" style={{ fontSize: 12 }}>{msg}</span>}
      </div>
      <p className="faint" style={{ fontSize: 12, marginTop: 12 }}>
        Rolul (Admin, Manager, Editor, Closer) se schimbă din Echipă. Aici ajustezi, pentru fiecare persoană, ce meniuri vede și unde poate face modificări. Regulile se aplică și în baza de date, nu doar în meniu.
      </p>
    </div>
  );
}

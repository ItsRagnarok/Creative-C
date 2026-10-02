"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { NAV, ROLE_LABEL, ROLE_NOTE, type AppRole } from "@/lib/roles";
import NotificationsBell, { type NotificationRow } from "@/components/NotificationsBell";
import { createClient } from "@/lib/supabase/client";

type Props = {
  actualRole: AppRole;
  fullName: string;
  initials: string;
  activeKey: string;
  title: string;
  subtitle?: string;
  notifications: NotificationRow[];
  children: React.ReactNode;
};

export default function AppShell({
  actualRole,
  fullName,
  initials,
  activeKey,
  title,
  subtitle,
  notifications,
  children,
}: Props) {
  const isAdmin = actualRole === "admin";
  const [previewRole, setPreviewRole] = useState<AppRole>(actualRole);
  const router = useRouter();
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwDone, setPwDone] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);

  function closePw() {
    setPwOpen(false);
    setPw("");
    setPw2("");
    setPwError(null);
    setPwDone(false);
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8) return setPwError("Parola trebuie să aibă minim 8 caractere.");
    if (pw !== pw2) return setPwError("Parolele nu coincid.");
    setPwSaving(true);
    setPwError(null);
    const { error } = await createClient().auth.updateUser({ password: pw });
    setPwSaving(false);
    if (error) return setPwError(error.message);
    setPwDone(true);
  }

  useEffect(() => {
    // Read after mount (not via lazy useState init) so SSR markup — rendered
    // with no access to localStorage — matches the client's first paint.
    if (!isAdmin) return;
    const stored = window.localStorage.getItem("cc_preview_role") as AppRole | null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored) setPreviewRole(stored);
  }, [isAdmin]);

  const effectiveRole = isAdmin ? previewRole : actualRole;

  function handlePreviewChange(role: AppRole) {
    setPreviewRole(role);
    window.localStorage.setItem("cc_preview_role", role);
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const groups = useMemo(
    () =>
      NAV.map((g) => ({
        ...g,
        items: g.items.filter((i) => i.roles.includes(effectiveRole)),
      })).filter((g) => g.items.length),
    [effectiveRole],
  );

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">CC</div>
          <div>
            <div className="brand-name">Creative C</div>
            <div className="brand-sub">CRM intern</div>
          </div>
        </div>

        {groups.map((g) => (
          <div className="nav-group" key={g.group}>
            <div className="nav-label">{g.group}</div>
            {g.items.map((item) =>
              item.enabled ? (
                <Link
                  key={item.key}
                  href={item.href}
                  className={`nav-item ${item.key === activeKey ? "active" : ""}`}
                >
                  <span className="ic">{item.icon}</span>
                  <span>{item.label}</span>
                  {item.ext && <span className="ext">{item.ext}</span>}
                </Link>
              ) : (
                <span key={item.key} className="nav-item disabled" title="Vine în curând">
                  <span className="ic">{item.icon}</span>
                  <span>{item.label}</span>
                  <span className="ext">curând</span>
                </span>
              ),
            )}
          </div>
        ))}

        <div className="sidebar-foot">
          <div className="role-note">
            <b>
              {isAdmin && previewRole !== actualRole ? `Previzualizezi ca: ${ROLE_LABEL[previewRole]}` : `Rolul tău: ${ROLE_LABEL[actualRole]}`}
            </b>
            <br />
            {ROLE_NOTE[effectiveRole]}
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="crumb">
            {title}
            {subtitle && <div className="sub">{subtitle}</div>}
          </div>
          <div className="search">
            <span>🔍</span>
            <span>Caută clienți, proiecte, facturi…</span>
          </div>
          <div className="top-actions">
            {isAdmin && (
              <div className="role-switch">
                Rol previzualizare
                <select
                  value={previewRole}
                  onChange={(e) => handlePreviewChange(e.target.value as AppRole)}
                >
                  {(Object.keys(ROLE_LABEL) as AppRole[]).map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <NotificationsBell initial={notifications} />
            <button className="avatar" title={`${fullName} — schimbă parola`} onClick={() => setPwOpen(true)}>
              {initials}
            </button>
            <button className="icon-btn logout" title="Deconectare" aria-label="Deconectare" onClick={handleLogout}>
              ⏻
            </button>
          </div>
        </header>

        <div className="content">{children}</div>

        {pwOpen && (
          <div className="modal-overlay" onClick={closePw}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-head">
                <h3>Schimbă parola</h3>
                <button className="modal-close" onClick={closePw}>✕</button>
              </div>
              {pwDone ? (
                <>
                  <p style={{ marginBottom: 14 }}>Parola a fost schimbată.</p>
                  <button type="button" className="btn primary" style={{ width: "100%", justifyContent: "center" }} onClick={closePw}>
                    Gata
                  </button>
                </>
              ) : (
                <form onSubmit={handlePasswordChange}>
                  <p className="faint" style={{ marginBottom: 12, fontSize: 12 }}>{fullName}</p>
                  <div className="field">
                    <label>Parolă nouă</label>
                    <input type="password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} placeholder="minim 8 caractere" />
                  </div>
                  <div className="field">
                    <label>Repetă parola</label>
                    <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
                  </div>
                  {pwError && <div className="field-error">{pwError}</div>}
                  <button type="submit" className="btn primary" style={{ width: "100%", justifyContent: "center", marginTop: 6 }} disabled={pwSaving}>
                    {pwSaving ? "Se salvează…" : "Salvează parola"}
                  </button>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

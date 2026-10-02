"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { NAV, ROLE_LABEL, ROLE_NOTE, type AppRole } from "@/lib/roles";
import type { Access, MenuKey } from "@/lib/access";
import NotificationsBell, { type NotificationRow } from "@/components/NotificationsBell";
import { createClient } from "@/lib/supabase/client";

type Props = {
  actualRole: AppRole;
  fullName: string;
  initials: string;
  notifications: NotificationRow[];
  access?: Access;
  isSuperAdmin?: boolean;
  children: React.ReactNode;
};

export default function AppShell({
  actualRole,
  fullName,
  initials,
  notifications,
  access,
  isSuperAdmin,
  children,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();

  // Active menu item, page title and section all come from the URL, so the shell never has to be re-rendered by a page.
  const current = useMemo(() => {
    let best: { key: string; label: string; group: string; len: number } | null = null;
    for (const g of NAV) {
      for (const i of g.items) {
        if ((pathname === i.href || pathname.startsWith(i.href + "/")) && (!best || i.href.length > best.len)) {
          best = { key: i.key, label: i.label, group: g.group, len: i.href.length };
        }
      }
    }
    return best;
  }, [pathname]);
  const activeKey = current?.key ?? "";
  const title = current?.label ?? "";
  const subtitle = current?.group;
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

  const effectiveRole = actualRole;

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
        items: g.items.filter((i) => {
          if (i.key === "setari" || i.key === "email") return !!isSuperAdmin; // roles, access & email are admin S only
          if (access) return access[(i.key === "prospecti" ? "clienti" : i.key) as MenuKey]?.view ?? false; // prospects follow the Clienți access
          return i.roles.includes(effectiveRole);
        }),
      })).filter((g) => g.items.length),
    [effectiveRole, access, isSuperAdmin],
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
              Rolul tău: {ROLE_LABEL[actualRole]}
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

"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type TeamMember = { id: string; full_name: string; role: string };
export type SlugRow = { slug: string; owner_id: string };
export type BookingSettings = { priority_user_id: string | null; priority_enabled: boolean };

const ROLE_NAME: Record<string, string> = { admin: "Admin", manager: "Manager", vanzari: "Closer" };
const clean = (s: string) =>
  s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// Admin S only. The general link goes to admins + closers (by their hours, priority person first if enabled);
// each team member can have exactly one personal link, which books strictly with that person.
export default function BookingAdminTools({
  team,
  initialSlugs,
  initialSettings,
}: {
  team: TeamMember[];
  initialSlugs: SlugRow[];
  initialSettings: BookingSettings;
}) {
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [slugs, setSlugs] = useState(initialSlugs);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [settings, setSettings] = useState(initialSettings);
  const [msg, setMsg] = useState<string | null>(null);

  const pool = team.filter((t) => t.role === "admin" || t.role === "vanzari"); // who can receive from the general link
  const linkOf = (s: string) => `${window.location.origin}/programeaza${s ? `/${s}` : ""}`;
  const slugOf = (ownerId: string) => slugs.find((s) => s.owner_id === ownerId)?.slug ?? null;

  async function copy(path: string) {
    try {
      await navigator.clipboard.writeText(linkOf(path));
      setMsg("Link copiat ✓");
    } catch {
      window.prompt("Copiază linkul:", linkOf(path));
    }
  }

  async function saveSettings(next: BookingSettings) {
    setSettings(next);
    const { error } = await supabase.from("booking_settings").upsert({ id: true, ...next });
    setMsg(error ? error.message : "Salvat ✓");
  }

  async function createLink(ownerId: string) {
    const slug = clean(drafts[ownerId] ?? "");
    if (!slug) return setMsg("Scrie un nume pentru link.");
    const { error } = await supabase.from("booking_slugs").insert({ slug, owner_id: ownerId });
    if (error) return setMsg(error.code === "23505" ? "Numele acesta de link există deja." : error.message);
    setSlugs((p) => [...p, { slug, owner_id: ownerId }]);
    setDrafts((d) => ({ ...d, [ownerId]: "" }));
    setMsg("Link creat ✓");
  }

  async function renameLink(ownerId: string, value: string) {
    const current = slugOf(ownerId);
    const slug = clean(value);
    if (!current || slug === current) return setDrafts((d) => ({ ...d, [ownerId]: "" }));
    if (!slug) return setMsg("Numele linkului nu poate fi gol.");
    const { error } = await supabase.from("booking_slugs").update({ slug }).eq("owner_id", ownerId);
    if (error) return setMsg(error.code === "23505" ? "Numele acesta de link există deja." : error.message);
    setSlugs((p) => p.map((s) => (s.owner_id === ownerId ? { ...s, slug } : s)));
    setDrafts((d) => ({ ...d, [ownerId]: "" }));
    setMsg("Link redenumit ✓ (linkul vechi nu mai funcționează)");
  }

  async function removeLink(ownerId: string) {
    const { error } = await supabase.from("booking_slugs").delete().eq("owner_id", ownerId);
    if (error) return setMsg(error.message);
    setSlugs((p) => p.filter((s) => s.owner_id !== ownerId));
    setMsg("Link șters.");
  }

  return (
    <>
      <button type="button" className="btn ghost" onClick={() => { setMsg(null); setOpen(true); }}>Linkuri</button>
      {open && (
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div className="modal" style={{ maxWidth: 1040, width: "96vw", maxHeight: "90vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Linkuri de programare</h3>
              <button className="modal-close" onClick={() => setOpen(false)}>✕</button>
            </div>

            <div className="admin-tools-grid">
              {/* LEFT: personal links, one per person */}
              <div>
                <div className="nav-label" style={{ padding: 0, marginBottom: 6 }}>Linkuri personale</div>
                <p className="faint" style={{ fontSize: 12, marginBottom: 10 }}>
                  Fiecare persoană are un singur link. Clientul vede doar programul ei și se programează strict la ea. Numele linkului îl alegi tu (ex: <code>s1-ing</code> pentru Instagram) și îți arată de unde a venit clientul.
                </p>
                <div className="list">
                  {team.map((t) => {
                    const slug = slugOf(t.id);
                    return (
                      <div key={t.id} className="list-row" style={{ gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                        <div style={{ width: 150 }}>
                          <div className="p-name" style={{ fontSize: 13 }}>{t.full_name}</div>
                          <div className="faint" style={{ fontSize: 11 }}>{ROLE_NAME[t.role] ?? t.role}</div>
                        </div>
                        {slug ? (
                          <>
                            <span className="faint" style={{ fontSize: 12 }}>/programeaza/</span>
                            <input
                              style={{ flex: 1, minWidth: 90 }}
                              value={drafts[t.id] ?? slug}
                              onChange={(e) => setDrafts((d) => ({ ...d, [t.id]: e.target.value }))}
                              onBlur={(e) => renameLink(t.id, e.target.value)}
                            />
                            <button type="button" className="btn sm ghost" onClick={() => copy(slug)}>Copiază</button>
                            <button type="button" className="icon-btn" style={{ width: 26, height: 26 }} title="Șterge linkul" onClick={() => removeLink(t.id)}>✕</button>
                          </>
                        ) : (
                          <>
                            <input
                              style={{ flex: 1, minWidth: 110 }}
                              placeholder="nume link, ex: s1-ing"
                              value={drafts[t.id] ?? ""}
                              onChange={(e) => setDrafts((d) => ({ ...d, [t.id]: e.target.value }))}
                              onKeyDown={(e) => e.key === "Enter" && createLink(t.id)}
                            />
                            <button type="button" className="btn sm primary" onClick={() => createLink(t.id)}>Creează link</button>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* RIGHT: general link + priority person */}
              <div>
                <div className="nav-label" style={{ padding: 0, marginBottom: 6 }}>Linkul general</div>
                <p className="faint" style={{ fontSize: 12, marginBottom: 10 }}>
                  Îl poate trimite oricine. Programările merg doar la admini și closeri, în funcție de programul fiecăruia. Clientul vede orele din toată săptămâna (luni–vineri) în care măcar unul e liber.
                </p>
                <div className="card" style={{ padding: 12, marginBottom: 18, display: "flex", alignItems: "center", gap: 10 }}>
                  <span className="mono" style={{ fontSize: 12.5, flex: 1 }}>/programeaza</span>
                  <button type="button" className="btn sm ghost" onClick={() => copy("")}>Copiază</button>
                </div>

                <div className="nav-label" style={{ padding: 0, marginBottom: 6 }}>Persoană prioritară (doar linkul general)</div>
                <p className="faint" style={{ fontSize: 12, marginBottom: 10 }}>
                  Cât timp e activă, persoana aleasă primește lead-ul când e liberă la ora aleasă. Dacă nu e liberă, se aplică regula obișnuită (cel mai puțin încărcat). Fără prioritate, merge doar după program.
                </p>
                <div className="card" style={{ padding: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <select
                    style={{ flex: 1, minWidth: 160 }}
                    value={settings.priority_user_id ?? ""}
                    onChange={(e) => saveSettings({ ...settings, priority_user_id: e.target.value || null, priority_enabled: e.target.value ? settings.priority_enabled : false })}
                  >
                    <option value="">— nimeni —</option>
                    {pool.map((t) => (
                      <option key={t.id} value={t.id}>{t.full_name} ({ROLE_NAME[t.role]})</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className={`btn sm ${settings.priority_enabled ? "primary" : "ghost"}`}
                    disabled={!settings.priority_user_id}
                    onClick={() => saveSettings({ ...settings, priority_enabled: !settings.priority_enabled })}
                  >
                    {settings.priority_enabled ? "● Prioritate activă" : "Activează prioritatea"}
                  </button>
                </div>
              </div>
            </div>
            {msg && <div className="faint" style={{ fontSize: 12, marginTop: 12 }}>{msg}</div>}
          </div>
        </div>
      )}
    </>
  );
}

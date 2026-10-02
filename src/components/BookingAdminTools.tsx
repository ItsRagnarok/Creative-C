"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type TeamMember = { id: string; full_name: string; role: string };
export type SlugRow = { slug: string; owner_id: string };
export type BookingSettings = { priority_user_id: string | null; priority_enabled: boolean };

const ROLE_NAME: Record<string, string> = { admin: "Admin", manager: "Manager", vanzari: "Closer" };
const clean = (s: string) =>
  s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// Admin S only. The general link goes to admins, managers + closers (general hours, priority person first if enabled);
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
  const [pick, setPick] = useState("");
  const [name, setName] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [settings, setSettings] = useState(initialSettings);
  const [msg, setMsg] = useState<string | null>(null);

  const pool = team.filter((t) => t.role === "admin" || t.role === "manager" || t.role === "vanzari"); // who can receive from the general link
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

  async function createLink() {
    const slug = clean(name);
    if (!pick) return setMsg("Alege o persoană.");
    if (!slug) return setMsg("Scrie un nume pentru link.");
    const { error } = await supabase.from("booking_slugs").insert({ slug, owner_id: pick });
    if (error) return setMsg(error.code === "23505" ? "Numele sau persoana are deja un link." : error.message);
    setSlugs((p) => [...p, { slug, owner_id: pick }]);
    setName("");
    setPick("");
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
              {/* LEFT: create a personal link, created links listed below */}
              <div>
                <div className="nav-label" style={{ padding: 0, marginBottom: 6 }}>Linkuri personale</div>
                <p className="faint" style={{ fontSize: 12, marginBottom: 10 }}>
                  Alege persoana, dă un nume linkului (ex: <code>s1-ing</code>) și creează-l. Clientul vede doar programul ei.
                </p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
                  <select style={{ flex: 1, minWidth: 140 }} value={pick} onChange={(e) => setPick(e.target.value)}>
                    <option value="">Alege persoana…</option>
                    {team.filter((t) => !slugOf(t.id)).map((t) => (
                      <option key={t.id} value={t.id}>{t.full_name} ({ROLE_NAME[t.role] ?? t.role})</option>
                    ))}
                  </select>
                  <input style={{ flex: 1, minWidth: 120 }} placeholder="nume link" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && createLink()} />
                  <button type="button" className="btn primary" onClick={createLink}>Creează link</button>
                </div>
                <div className="list">
                  {slugs.length === 0 && <div className="faint" style={{ fontSize: 12 }}>Încă niciun link creat.</div>}
                  {slugs.map((l) => {
                    const t = team.find((x) => x.id === l.owner_id);
                    return (
                      <div key={l.owner_id} className="list-row" style={{ gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <div style={{ width: 120, fontSize: 13, fontWeight: 600 }}>{t?.full_name ?? "—"}</div>
                        <span className="faint" style={{ fontSize: 12 }}>/programeaza/</span>
                        <input
                          style={{ flex: 1, minWidth: 80 }}
                          value={drafts[l.owner_id] ?? l.slug}
                          onChange={(e) => setDrafts((d) => ({ ...d, [l.owner_id]: e.target.value }))}
                          onBlur={(e) => renameLink(l.owner_id, e.target.value)}
                        />
                        <button type="button" className="btn sm ghost" onClick={() => copy(l.slug)}>Copiază</button>
                        <button type="button" className="icon-btn" style={{ width: 26, height: 26 }} title="Șterge linkul" onClick={() => removeLink(l.owner_id)}>✕</button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* RIGHT: priority only */}
              <div>
                <div className="nav-label" style={{ padding: 0, marginBottom: 6 }}>Prioritate</div>
                <p className="faint" style={{ fontSize: 12, marginBottom: 10 }}>
                  Persoana aleasă primește primul lead-ul de pe linkul general, când e liberă. Alegerea o activează automat.
                </p>
                <select
                  style={{ width: "100%", marginBottom: 10 }}
                  value={settings.priority_user_id ?? ""}
                  onChange={(e) => saveSettings({ priority_user_id: e.target.value || null, priority_enabled: !!e.target.value })}
                >
                  <option value="">— nimeni —</option>
                  {pool.map((t) => (
                    <option key={t.id} value={t.id}>{t.full_name} ({ROLE_NAME[t.role]})</option>
                  ))}
                </select>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    className="btn"
                    disabled={!settings.priority_user_id}
                    style={settings.priority_enabled ? { background: "#1f9d55", borderColor: "#1f9d55", color: "#fff" } : undefined}
                    onClick={() => saveSettings({ ...settings, priority_enabled: true })}
                  >
                    Activează
                  </button>
                  <button
                    type="button"
                    className="btn"
                    disabled={!settings.priority_user_id}
                    style={settings.priority_user_id && !settings.priority_enabled ? { background: "#1f9d55", borderColor: "#1f9d55", color: "#fff" } : undefined}
                    onClick={() => saveSettings({ ...settings, priority_enabled: false })}
                  >
                    Dezactivează
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

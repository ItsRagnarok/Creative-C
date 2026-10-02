"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type TeamMember = { id: string; full_name: string };
export type SlugRow = { slug: string; owner_id: string };
export type PriorityList = { id: string; name: string; active: boolean };
export type PriorityItem = { list_id: string; user_id: string; position: number };

// Admin S only: custom links attributed to a team member (left) + priority lists (right).
// Every list is visible at once, edits save automatically, and exactly one list can be active (or none).
export default function BookingAdminTools({
  team,
  initialSlugs,
  initialLists,
  initialItems,
}: {
  team: TeamMember[];
  initialSlugs: SlugRow[];
  initialLists: PriorityList[];
  initialItems: PriorityItem[];
}) {
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [slugs, setSlugs] = useState(initialSlugs);
  const [lists, setLists] = useState(initialLists);
  const [orders, setOrders] = useState<Record<string, string[]>>(() => {
    const o: Record<string, string[]> = {};
    for (const l of initialLists) {
      o[l.id] = initialItems.filter((i) => i.list_id === l.id).sort((x, y) => x.position - y.position).map((i) => i.user_id);
    }
    return o;
  });
  const [status, setStatus] = useState<Record<string, string>>({});
  const [owner, setOwner] = useState(team[0]?.id ?? "");
  const [slug, setSlug] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const nameOf = (id: string) => team.find((t) => t.id === id)?.full_name ?? "—";
  const linkOf = (s: string) => `${window.location.origin}/programeaza/${s}`;
  const activeList = lists.find((l) => l.active) ?? null;
  const flash = (id: string, text: string) => setStatus((s) => ({ ...s, [id]: text }));

  async function copy(s: string) {
    try {
      await navigator.clipboard.writeText(linkOf(s));
      setMsg("Link copiat ✓");
    } catch {
      window.prompt("Copiază linkul:", linkOf(s));
    }
  }

  async function addLink(e: React.FormEvent) {
    e.preventDefault();
    const clean = slug.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (!clean || !owner) return setMsg("Alege persoana și un nume pentru link.");
    setMsg(null);
    const { error } = await supabase.from("booking_slugs").insert({ slug: clean, owner_id: owner });
    if (error) return setMsg(error.code === "23505" ? "Numele acesta de link există deja." : error.message);
    setSlugs((prev) => [...prev, { slug: clean, owner_id: owner }]);
    setSlug("");
  }

  async function removeLink(s: string) {
    const { error } = await supabase.from("booking_slugs").delete().eq("slug", s);
    if (error) return setMsg(error.message);
    setSlugs((prev) => prev.filter((x) => x.slug !== s));
  }

  // ---- priority lists ----
  async function persistOrder(listId: string, order: string[]) {
    setOrders((o) => ({ ...o, [listId]: order }));
    flash(listId, "Se salvează…");
    const { error: delErr } = await supabase.from("booking_priority_items").delete().eq("list_id", listId);
    if (delErr) return flash(listId, `Eroare: ${delErr.message}`);
    if (order.length > 0) {
      const { error } = await supabase.from("booking_priority_items").insert(order.map((user_id, i) => ({ list_id: listId, user_id, position: i + 1 })));
      if (error) return flash(listId, `Eroare: ${error.message}`);
    }
    flash(listId, "Salvat ✓");
  }

  function move(listId: string, i: number, d: -1 | 1) {
    const cur = [...(orders[listId] ?? [])];
    const j = i + d;
    if (j < 0 || j >= cur.length) return;
    [cur[i], cur[j]] = [cur[j], cur[i]];
    persistOrder(listId, cur);
  }

  async function newList() {
    setMsg(null);
    const name = `Lista ${lists.length + 1}`;
    const { data, error } = await supabase.from("booking_priority_lists").insert({ name, active: false }).select("*").single();
    if (error) return setMsg(error.message);
    setLists((p) => [...p, data as PriorityList]);
    setOrders((o) => ({ ...o, [data.id]: [] }));
  }

  async function rename(id: string, name: string) {
    const clean = name.trim();
    const prev = lists.find((l) => l.id === id)?.name;
    if (!clean || clean === prev) return setLists((p) => p.map((l) => (l.id === id ? { ...l, name: prev ?? l.name } : l)));
    const { error } = await supabase.from("booking_priority_lists").update({ name: clean }).eq("id", id);
    if (error) return setMsg(error.message);
    flash(id, "Salvat ✓");
  }

  async function toggleActive(id: string) {
    setMsg(null);
    const turningOn = !lists.find((l) => l.id === id)?.active;
    // only one list may be active: switch everything off first, then turn the chosen one on
    const { error: offErr } = await supabase.from("booking_priority_lists").update({ active: false }).eq("active", true);
    if (offErr) return setMsg(offErr.message);
    if (turningOn) {
      const { error } = await supabase.from("booking_priority_lists").update({ active: true }).eq("id", id);
      if (error) return setMsg(error.message);
    }
    setLists((p) => p.map((l) => ({ ...l, active: turningOn && l.id === id })));
  }

  async function removeList(id: string) {
    const { error } = await supabase.from("booking_priority_lists").delete().eq("id", id);
    if (error) return setMsg(error.message);
    setLists((p) => p.filter((l) => l.id !== id));
  }

  return (
    <>
      <button type="button" className="btn ghost" onClick={() => { setMsg(null); setOpen(true); }}>Linkuri & prioritate</button>
      {open && (
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div className="modal" style={{ maxWidth: 1040, width: "96vw", maxHeight: "90vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Linkuri & prioritate</h3>
              <button className="modal-close" onClick={() => setOpen(false)}>✕</button>
            </div>

            <div className="admin-tools-grid">
              {/* LEFT: custom links */}
              <div>
                <div className="nav-label" style={{ padding: 0, marginBottom: 8 }}>Linkuri personalizate</div>
                <form onSubmit={addLink} style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                  <select value={owner} onChange={(e) => setOwner(e.target.value)}>
                    {team.map((t) => (
                      <option key={t.id} value={t.id}>{t.full_name}</option>
                    ))}
                  </select>
                  <input style={{ flex: 1, minWidth: 140 }} value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="nume link, ex: george-content" />
                  <button type="submit" className="btn sm primary">Creează</button>
                </form>
                <div className="list">
                  {slugs.map((s) => (
                    <div key={s.slug} className="list-row" style={{ gap: 10, alignItems: "center" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="mono" style={{ fontSize: 12.5 }}>/programeaza/{s.slug}</div>
                        <div className="faint" style={{ fontSize: 11.5 }}>trimis în numele: {nameOf(s.owner_id)}</div>
                      </div>
                      <button type="button" className="btn sm ghost" onClick={() => copy(s.slug)}>Copiază</button>
                      <button type="button" className="icon-btn" style={{ width: 26, height: 26 }} title="Șterge linkul" onClick={() => removeLink(s.slug)}>✕</button>
                    </div>
                  ))}
                  {slugs.length === 0 && <div className="empty-note">Niciun link personalizat încă.</div>}
                </div>
              </div>

              {/* RIGHT: priority lists */}
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  <div className="nav-label" style={{ padding: 0, flex: 1 }}>Liste de prioritate</div>
                  <button type="button" className="btn sm primary" onClick={newList}>+ Listă nouă</button>
                </div>
                <p className="faint" style={{ fontSize: 12, marginBottom: 10 }}>
                  Doar lista <b>activă</b> contează: lead-ul merge la primul din ea care e liber la ora aleasă. Dacă nimeni din listă nu e liber, îl preia cel care a trimis linkul. Fără listă activă nu există prioritate.
                </p>
                <div className="card" style={{ padding: "8px 12px", marginBottom: 12 }}>
                  <span className={`badge ${activeList ? "green" : "gray"}`}>{activeList ? `Prioritate activă: ${activeList.name}` : "Fără prioritate (nicio listă activă)"}</span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {lists.map((l) => {
                    const order = orders[l.id] ?? [];
                    const free = team.filter((t) => !order.includes(t.id));
                    return (
                      <div key={l.id} className="card" style={{ padding: 12, borderColor: l.active ? "var(--accent-2)" : undefined }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                          <input
                            style={{ flex: 1, fontWeight: 700 }}
                            value={l.name}
                            onChange={(e) => setLists((p) => p.map((x) => (x.id === l.id ? { ...x, name: e.target.value } : x)))}
                            onBlur={(e) => rename(l.id, e.target.value)}
                          />
                          <button type="button" className={`btn sm ${l.active ? "primary" : "ghost"}`} onClick={() => toggleActive(l.id)}>
                            {l.active ? "● Activă" : "Activează"}
                          </button>
                          <button type="button" className="icon-btn" style={{ width: 28, height: 28 }} title="Șterge lista" onClick={() => removeList(l.id)}>🗑</button>
                        </div>
                        {order.map((id, i) => (
                          <div key={id} className="list-row" style={{ gap: 8, alignItems: "center", padding: "6px 2px" }}>
                            <span className="faint" style={{ width: 18 }}>{i + 1}.</span>
                            <span style={{ flex: 1 }}>{nameOf(id)}</span>
                            <button type="button" className="icon-btn" style={{ width: 24, height: 24 }} onClick={() => move(l.id, i, -1)} disabled={i === 0}>↑</button>
                            <button type="button" className="icon-btn" style={{ width: 24, height: 24 }} onClick={() => move(l.id, i, 1)} disabled={i === order.length - 1}>↓</button>
                            <button type="button" className="icon-btn" style={{ width: 24, height: 24 }} onClick={() => persistOrder(l.id, order.filter((x) => x !== id))}>✕</button>
                          </div>
                        ))}
                        {order.length === 0 && <div className="faint" style={{ fontSize: 12, padding: "4px 2px" }}>Listă goală — adaugă oameni în ordinea priorității.</div>}
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                          {free.length > 0 && (
                            <select value="" onChange={(e) => e.target.value && persistOrder(l.id, [...order, e.target.value])}>
                              <option value="">+ Adaugă persoană…</option>
                              {free.map((t) => (
                                <option key={t.id} value={t.id}>{t.full_name}</option>
                              ))}
                            </select>
                          )}
                          <span className="faint" style={{ fontSize: 11.5, marginLeft: "auto" }}>{status[l.id] ?? ""}</span>
                        </div>
                      </div>
                    );
                  })}
                  {lists.length === 0 && <div className="empty-note">Nicio listă încă. Apasă „+ Listă nouă".</div>}
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

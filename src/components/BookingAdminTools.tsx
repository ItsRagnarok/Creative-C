"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type TeamMember = { id: string; full_name: string };
export type SlugRow = { slug: string; owner_id: string };
export type PriorityList = { id: string; name: string; active: boolean };
export type PriorityItem = { list_id: string; user_id: string; position: number };

// Admin S only: custom links attributed to a team member + named priority lists (one can be active).
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
  const [selected, setSelected] = useState<string | null>(initialLists.find((l) => l.active)?.id ?? initialLists[0]?.id ?? null);
  const [newName, setNewName] = useState("");
  const [owner, setOwner] = useState(team[0]?.id ?? "");
  const [slug, setSlug] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const order = selected ? orders[selected] ?? [] : [];
  const setOrder = (fn: (o: string[]) => string[]) => selected && setOrders((all) => ({ ...all, [selected]: fn(all[selected] ?? []) }));
  const activeList = lists.find((l) => l.active) ?? null;

  const nameOf = (id: string) => team.find((t) => t.id === id)?.full_name ?? "—";
  const linkOf = (s: string) => `${window.location.origin}/programeaza/${s}`;

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

  function move(i: number, d: -1 | 1) {
    setOrder((o) => {
      const j = i + d;
      if (j < 0 || j >= o.length) return o;
      const next = [...o];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  async function createList(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    const { data, error } = await supabase.from("booking_priority_lists").insert({ name, active: false }).select("*").single();
    if (error) return setMsg(error.message);
    setLists((p) => [...p, data as PriorityList]);
    setOrders((o) => ({ ...o, [data.id]: [] }));
    setSelected(data.id);
    setNewName("");
    setMsg(null);
  }

  async function saveList() {
    if (!selected) return;
    setSaving(true);
    setMsg(null);
    const { error: delErr } = await supabase.from("booking_priority_items").delete().eq("list_id", selected);
    if (delErr) {
      setSaving(false);
      return setMsg(delErr.message);
    }
    if (order.length > 0) {
      const { error } = await supabase.from("booking_priority_items").insert(order.map((user_id, i) => ({ list_id: selected, user_id, position: i + 1 })));
      if (error) {
        setSaving(false);
        return setMsg(error.message);
      }
    }
    setSaving(false);
    setMsg("Lista a fost salvată.");
  }

  async function activate(id: string | null) {
    setMsg(null);
    // only one list can be active: switch everything off first, then turn the chosen one on
    const { error: offErr } = await supabase.from("booking_priority_lists").update({ active: false }).eq("active", true);
    if (offErr) return setMsg(offErr.message);
    if (id) {
      const { error } = await supabase.from("booking_priority_lists").update({ active: true }).eq("id", id);
      if (error) return setMsg(error.message);
    }
    setLists((p) => p.map((l) => ({ ...l, active: l.id === id })));
    setMsg(id ? "Lista este acum activă." : "Prioritățile sunt dezactivate — se folosește logica de bază.");
  }

  async function removeList() {
    if (!selected) return;
    const { error } = await supabase.from("booking_priority_lists").delete().eq("id", selected);
    if (error) return setMsg(error.message);
    const rest = lists.filter((l) => l.id !== selected);
    setLists(rest);
    setSelected(rest[0]?.id ?? null);
  }

  const notInOrder = team.filter((t) => !order.includes(t.id));

  return (
    <>
      <button type="button" className="btn ghost" onClick={() => { setMsg(null); setOpen(true); }}>Linkuri & prioritate</button>
      {open && (
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div className="modal" style={{ maxWidth: 600 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Linkuri & prioritate</h3>
              <button className="modal-close" onClick={() => setOpen(false)}>✕</button>
            </div>

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
            <div className="list" style={{ marginBottom: 20 }}>
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

            <div className="nav-label" style={{ padding: 0, marginBottom: 6 }}>Liste de prioritate</div>
            <p className="faint" style={{ fontSize: 12, marginBottom: 8 }}>
              Cât timp o listă e activă, lead-ul merge la primul din listă care e liber la ora aleasă de client (indiferent cine a trimis linkul). Dacă nimeni din listă nu e liber, îl preia cel care a trimis linkul. Fără listă activă se folosește logica de bază (cel care a trimis linkul, apoi cel mai liber coleg).
            </p>
            <div className="card" style={{ padding: "10px 14px", marginBottom: 10, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span className={`badge ${activeList ? "green" : "gray"}`}>{activeList ? `Activă: ${activeList.name}` : "Prioritățile sunt dezactivate"}</span>
              {activeList && (
                <button type="button" className="btn sm ghost" style={{ marginLeft: "auto" }} onClick={() => activate(null)}>Dezactivează prioritățile</button>
              )}
            </div>
            <form onSubmit={createList} style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <input style={{ flex: 1 }} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Listă nouă, ex: Lista 2" />
              <button type="submit" className="btn sm" disabled={!newName.trim()}>+ Listă nouă</button>
            </form>
            {lists.length > 0 && (
              <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                <select value={selected ?? ""} onChange={(e) => setSelected(e.target.value)} style={{ flex: 1 }}>
                  {lists.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}{l.active ? " (activă)" : ""}</option>
                  ))}
                </select>
                <button type="button" className="btn sm primary" disabled={!selected || !!lists.find((l) => l.id === selected)?.active} onClick={() => activate(selected)}>Activează lista</button>
                <button type="button" className="icon-btn" style={{ width: 30, height: 30 }} title="Șterge lista" onClick={removeList}>🗑</button>
              </div>
            )}
            {selected && (
              <>
                <div className="list" style={{ marginBottom: 8 }}>
                  {order.map((id, i) => (
                    <div key={id} className="list-row" style={{ gap: 8, alignItems: "center" }}>
                      <span className="faint" style={{ width: 20 }}>{i + 1}.</span>
                      <span style={{ flex: 1 }}>{nameOf(id)}</span>
                      <button type="button" className="icon-btn" style={{ width: 26, height: 26 }} onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
                      <button type="button" className="icon-btn" style={{ width: 26, height: 26 }} onClick={() => move(i, 1)} disabled={i === order.length - 1}>↓</button>
                      <button type="button" className="icon-btn" style={{ width: 26, height: 26 }} onClick={() => setOrder((o) => o.filter((x) => x !== id))}>✕</button>
                    </div>
                  ))}
                  {order.length === 0 && <div className="empty-note">Lista e goală — adaugă oameni, în ordinea priorității.</div>}
                </div>
                {notInOrder.length > 0 && (
                  <select value="" onChange={(e) => e.target.value && setOrder((o) => [...o, e.target.value])} style={{ marginBottom: 10 }}>
                    <option value="">+ Adaugă în listă…</option>
                    {notInOrder.map((t) => (
                      <option key={t.id} value={t.id}>{t.full_name}</option>
                    ))}
                  </select>
                )}
                <button type="button" className="btn primary" style={{ width: "100%", justifyContent: "center" }} onClick={saveList} disabled={saving}>
                  {saving ? "Se salvează…" : "Salvează lista"}
                </button>
              </>
            )}
            {msg && <div className="faint" style={{ fontSize: 12, marginTop: 8 }}>{msg}</div>}
          </div>
        </div>
      )}
    </>
  );
}

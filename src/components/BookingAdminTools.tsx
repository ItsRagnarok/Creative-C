"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type TeamMember = { id: string; full_name: string };
export type SlugRow = { slug: string; owner_id: string };
export type PriorityRow = { user_id: string; position: number };

// Admin S only: custom links attributed to a team member + the priority order for taking leads.
export default function BookingAdminTools({
  team,
  initialSlugs,
  initialPriority,
}: {
  team: TeamMember[];
  initialSlugs: SlugRow[];
  initialPriority: PriorityRow[];
}) {
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [slugs, setSlugs] = useState(initialSlugs);
  const [order, setOrder] = useState<string[]>(() =>
    [...initialPriority].sort((a, b) => a.position - b.position).map((p) => p.user_id),
  );
  const [owner, setOwner] = useState(team[0]?.id ?? "");
  const [slug, setSlug] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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

  async function savePriority() {
    setSaving(true);
    setMsg(null);
    const { error: delErr } = await supabase.from("booking_priority").delete().neq("user_id", "00000000-0000-0000-0000-000000000000");
    if (delErr) {
      setSaving(false);
      return setMsg(delErr.message);
    }
    if (order.length > 0) {
      const { error } = await supabase.from("booking_priority").insert(order.map((user_id, i) => ({ user_id, position: i + 1 })));
      if (error) {
        setSaving(false);
        return setMsg(error.message);
      }
    }
    setSaving(false);
    setMsg("Prioritățile au fost salvate.");
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

            <div className="nav-label" style={{ padding: 0, marginBottom: 6 }}>Prioritate lead-uri</div>
            <p className="faint" style={{ fontSize: 12, marginBottom: 8 }}>
              Când clientul alege o oră, lead-ul merge la primul din listă care e liber atunci (indiferent cine a trimis linkul). Dacă nimeni din listă nu e liber, îl preia cel care a trimis linkul.
            </p>
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
              {order.length === 0 && <div className="empty-note">Fără prioritizare: lead-ul merge la cel care a trimis linkul.</div>}
            </div>
            {notInOrder.length > 0 && (
              <select value="" onChange={(e) => e.target.value && setOrder((o) => [...o, e.target.value])} style={{ marginBottom: 10 }}>
                <option value="">+ Adaugă în lista de prioritate…</option>
                {notInOrder.map((t) => (
                  <option key={t.id} value={t.id}>{t.full_name}</option>
                ))}
              </select>
            )}
            <button type="button" className="btn primary" style={{ width: "100%", justifyContent: "center" }} onClick={savePriority} disabled={saving}>
              {saving ? "Se salvează…" : "Salvează prioritățile"}
            </button>
            {msg && <div className="faint" style={{ fontSize: 12, marginTop: 8 }}>{msg}</div>}
          </div>
        </div>
      )}
    </>
  );
}

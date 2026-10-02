"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { functionErrorMessage } from "@/lib/supabase/functionError";

export type TemplateRow = {
  id: string;
  name: string;
  subject: string;
  body: string;
  is_html: boolean;
  delay_minutes: number;
  enabled: boolean;
  position: number;
};
export type OutboxRow = {
  id: string;
  to_email: string;
  to_name: string | null;
  subject: string;
  status: "pending" | "sending" | "sent" | "failed";
  error: string | null;
  send_at: string;
  sent_at: string | null;
  created_at: string;
};
export type ClientContact = { email: string; name: string };
type TeamMember = { id: string; full_name: string; role: string };

const SAMPLE: Record<string, string> = {
  nume: "Maria Popescu",
  data: "07.10.2026",
  ora: "10:00",
  cu_cine: "Georgiana",
  apel: "Apel de strategie content",
};
const STATUS_BADGE: Record<OutboxRow["status"], string> = { pending: "amber", sending: "blue", sent: "green", failed: "red" };
const STATUS_LABEL: Record<OutboxRow["status"], string> = { pending: "În așteptare", sending: "Se trimite", sent: "Trimis", failed: "Eșuat" };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function fill(tpl: string, vars: Record<string, string>, html: boolean) {
  return tpl.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vars ? (html ? esc(vars[k]) : vars[k]) : m));
}

function Preview({ subject, body, isHtml, vars }: { subject: string; body: string; isHtml: boolean; vars: Record<string, string> }) {
  const rendered = fill(body, vars, isHtml);
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", background: "#fff", color: "#111" }}>
      <div style={{ padding: "8px 12px", background: "#f3f3f5", fontSize: 12.5, borderBottom: "1px solid #e5e5ea" }}>
        <b>Subiect:</b> {fill(subject, vars, false) || <span style={{ color: "#999" }}>(fără subiect)</span>}
      </div>
      {isHtml ? (
        // sandboxed: no scripts, no navigation — safe to preview arbitrary HTML
        <iframe title="Previzualizare email" sandbox="" srcDoc={`<base target="_blank"><body style="font-family:Arial,sans-serif;margin:16px">${rendered}</body>`} style={{ width: "100%", height: 260, border: "none", background: "#fff" }} />
      ) : (
        <pre style={{ margin: 0, padding: 14, whiteSpace: "pre-wrap", fontFamily: "Arial,sans-serif", fontSize: 13.5, minHeight: 120 }}>{rendered || " "}</pre>
      )}
    </div>
  );
}

export default function EmailAdmin({
  initialTemplates,
  initialOutbox,
  clients,
  team,
  currentUserId,
}: {
  initialTemplates: TemplateRow[];
  initialOutbox: OutboxRow[];
  clients: ClientContact[];
  team: TeamMember[];
  currentUserId: string;
}) {
  const supabase = createClient();
  const [tab, setTab] = useState<"templates" | "send" | "history">("templates");
  const [config, setConfig] = useState<{ configured: boolean; provider: string | null } | null>(null);
  const [templates, setTemplates] = useState(initialTemplates);
  const [saved, setSaved] = useState<Record<string, string>>({});
  const [outbox, setOutbox] = useState(initialOutbox);
  const [teamEmails, setTeamEmails] = useState<Record<string, string>>({});

  // send tab
  const [source, setSource] = useState<"clients" | "team">("clients");
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<Map<string, string>>(new Map()); // email -> name
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isHtml, setIsHtml] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendMsg, setSendMsg] = useState<string | null>(null);

  useEffect(() => {
    supabase.functions.invoke("process-emails", { body: { action: "status" } }).then(({ data }) => {
      if (data) setConfig({ configured: !!data.configured, provider: data.provider ?? null });
    });
    supabase.functions.invoke("manage-team-member", { body: { action: "emails" } }).then(({ data }) => {
      if (data?.emails) setTeamEmails(data.emails);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- templates ----------
  async function persist(t: TemplateRow) {
    setSaved((s) => ({ ...s, [t.id]: "Se salvează…" }));
    const { error } = await supabase
      .from("email_templates")
      .update({ name: t.name, subject: t.subject, body: t.body, is_html: t.is_html, delay_minutes: t.delay_minutes, enabled: t.enabled })
      .eq("id", t.id);
    setSaved((s) => ({ ...s, [t.id]: error ? `Eroare: ${error.message}` : "Salvat ✓" }));
  }
  function patch(id: string, p: Partial<TemplateRow>, saveNow = false) {
    const next = templates.map((t) => (t.id === id ? { ...t, ...p } : t));
    setTemplates(next);
    if (saveNow) persist(next.find((t) => t.id === id)!);
  }
  async function addTemplate() {
    const position = Math.max(0, ...templates.map((t) => t.position)) + 1;
    const { data, error } = await supabase
      .from("email_templates")
      .insert({ name: `Email ${templates.length + 1}`, subject: "", body: "", enabled: false, position })
      .select("*")
      .single();
    if (!error && data) setTemplates((p) => [...p, data as TemplateRow]);
  }
  async function removeTemplate(id: string) {
    if (!window.confirm("Ștergi acest email din secvență?")) return;
    const { error } = await supabase.from("email_templates").delete().eq("id", id);
    if (!error) setTemplates((p) => p.filter((t) => t.id !== id));
  }

  // ---------- send ----------
  const people = useMemo(() => {
    const list =
      source === "clients"
        ? clients.map((c) => ({ email: c.email, name: c.name, sub: c.email }))
        : team.filter((t) => teamEmails[t.id]).map((t) => ({ email: teamEmails[t.id], name: t.full_name, sub: `${teamEmails[t.id]} · ${t.role}` }));
    const q = search.trim().toLowerCase();
    return q ? list.filter((p) => p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q)) : list;
  }, [source, clients, team, teamEmails, search]);

  function toggle(email: string, name: string) {
    setPicked((prev) => {
      const next = new Map(prev);
      if (next.has(email)) next.delete(email);
      else next.set(email, name);
      return next;
    });
  }
  const allShownPicked = people.length > 0 && people.every((p) => picked.has(p.email));
  function toggleAllShown() {
    setPicked((prev) => {
      const next = new Map(prev);
      if (allShownPicked) people.forEach((p) => next.delete(p.email));
      else people.forEach((p) => next.set(p.email, p.name));
      return next;
    });
  }

  async function refreshOutbox() {
    const { data } = await supabase.from("email_outbox").select("*").order("created_at", { ascending: false }).limit(100);
    if (data) setOutbox(data as OutboxRow[]);
  }

  async function runQueue(): Promise<{ sent: number; failed: number; configured: boolean } | null> {
    const { data, error } = await supabase.functions.invoke("process-emails", { body: {} });
    if (error) {
      setSendMsg(await functionErrorMessage(error, "Nu am putut porni trimiterea."));
      return null;
    }
    return data as { sent: number; failed: number; configured: boolean };
  }

  async function send() {
    if (picked.size === 0) return setSendMsg("Alege cel puțin un destinatar.");
    if (!subject.trim() || !body.trim()) return setSendMsg("Completează subiectul și mesajul.");
    if (!window.confirm(`Trimiți acest email la ${picked.size} ${picked.size === 1 ? "destinatar" : "destinatari"}?`)) return;
    setSending(true);
    setSendMsg(null);
    const rows = Array.from(picked.entries()).map(([to_email, to_name]) => ({
      to_email,
      to_name,
      subject: fill(subject, { nume: to_name }, false),
      body: fill(body, { nume: to_name }, isHtml),
      is_html: isHtml,
      created_by: currentUserId,
    }));
    const { error } = await supabase.from("email_outbox").insert(rows);
    if (error) {
      setSending(false);
      return setSendMsg(error.message);
    }
    const res = await runQueue();
    await refreshOutbox();
    setSending(false);
    if (res) {
      setSendMsg(
        res.configured
          ? `Trimise: ${res.sent}${res.failed ? ` · eșuate: ${res.failed} (vezi Istoric)` : ""}.`
          : "Emailurile sunt puse în coadă și pleacă automat imediat ce configurezi trimiterea.",
      );
    }
    if (res?.configured && res.failed === 0) setPicked(new Map());
  }

  const firstName = picked.size > 0 ? Array.from(picked.values())[0] : SAMPLE.nume;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Email</h1>
          <p>Emailurile trimise clienților după programare și emailurile trimise direct din platformă.</p>
        </div>
      </div>

      {config && !config.configured && (
        <div className="card" style={{ marginBottom: 16, borderColor: "var(--warning)" }}>
          <b style={{ fontSize: 13.5 }}>Trimiterea de email nu e conectată încă.</b>
          <p style={{ fontSize: 12.5, marginTop: 4 }}>
            Poți pregăti totul acum: emailurile se pun în coadă și pleacă singure imediat ce conectezi un cont de email (Resend sau Gmail/SMTP) în Supabase → Edge Functions → Secrets.
          </p>
        </div>
      )}
      {config?.configured && (
        <div style={{ marginBottom: 12 }}>
          <span className="badge green">Trimitere activă ({config.provider === "resend" ? "Resend" : "SMTP"})</span>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        {([["templates", "După programare"], ["send", "Trimite email"], ["history", "Istoric"]] as const).map(([k, label]) => (
          <button key={k} type="button" className={`btn sm ${tab === k ? "primary" : "ghost"}`} onClick={() => { setTab(k); if (k === "history") refreshOutbox(); }}>
            {label}
          </button>
        ))}
      </div>

      {tab === "templates" && (
        <>
          <p className="faint" style={{ fontSize: 12.5, marginBottom: 12 }}>
            Fiecare email de mai jos pleacă la client după ce își face programarea, în ordinea din listă, la întârzierea setată (0 = imediat). Variabile: <code>{"{{nume}}"}</code> <code>{"{{data}}"}</code> <code>{"{{ora}}"}</code> <code>{"{{cu_cine}}"}</code> <code>{"{{apel}}"}</code>.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {templates.map((t, idx) => (
              <div key={t.id} className="card">
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
                  <b style={{ width: 22 }}>{idx + 1}.</b>
                  <input style={{ flex: 1, minWidth: 160, fontWeight: 700 }} value={t.name} onChange={(e) => patch(t.id, { name: e.target.value })} onBlur={() => persist(t)} />
                  <label className="faint" style={{ fontSize: 12 }}>
                    Trimite după{" "}
                    <input type="number" min={0} style={{ width: 70 }} value={t.delay_minutes} onChange={(e) => patch(t.id, { delay_minutes: Math.max(0, Number(e.target.value) || 0) })} onBlur={() => persist(t)} /> min
                  </label>
                  <select value={t.is_html ? "html" : "text"} onChange={(e) => patch(t.id, { is_html: e.target.value === "html" }, true)}>
                    <option value="text">Text simplu</option>
                    <option value="html">HTML</option>
                  </select>
                  <button type="button" className={`btn sm ${t.enabled ? "primary" : "ghost"}`} onClick={() => patch(t.id, { enabled: !t.enabled }, true)}>
                    {t.enabled ? "● Activ" : "Oprit"}
                  </button>
                  <button type="button" className="icon-btn" style={{ width: 28, height: 28 }} title="Șterge" onClick={() => removeTemplate(t.id)}>🗑</button>
                </div>
                <div className="grid g-2" style={{ alignItems: "start" }}>
                  <div>
                    <div className="field">
                      <label>Subiect</label>
                      <input value={t.subject} onChange={(e) => patch(t.id, { subject: e.target.value })} onBlur={() => persist(t)} placeholder="ex: Programarea ta: {{apel}}" />
                    </div>
                    <div className="field">
                      <label>{t.is_html ? "Cod HTML" : "Mesaj"}</label>
                      <textarea
                        rows={10}
                        style={{ fontFamily: t.is_html ? "var(--font-mono)" : undefined, fontSize: 12.5 }}
                        value={t.body}
                        onChange={(e) => patch(t.id, { body: e.target.value })}
                        onBlur={() => persist(t)}
                      />
                    </div>
                    <span className="faint" style={{ fontSize: 11.5 }}>{saved[t.id] ?? ""}</span>
                  </div>
                  <div>
                    <div className="nav-label" style={{ padding: 0, marginBottom: 6 }}>Previzualizare</div>
                    <Preview subject={t.subject} body={t.body} isHtml={t.is_html} vars={SAMPLE} />
                  </div>
                </div>
              </div>
            ))}
            {templates.length === 0 && <div className="empty-note">Niciun email configurat — clienții nu primesc nimic după programare.</div>}
          </div>
          <button type="button" className="btn" style={{ marginTop: 14 }} onClick={addTemplate}>+ Email nou în secvență</button>
        </>
      )}

      {tab === "send" && (
        <div className="grid g-2" style={{ alignItems: "start" }}>
          <div className="card">
            <div className="nav-label" style={{ padding: 0, marginBottom: 8 }}>Destinatari</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <button type="button" className={`btn sm ${source === "clients" ? "primary" : "ghost"}`} onClick={() => setSource("clients")}>Clienți ({clients.length})</button>
              <button type="button" className={`btn sm ${source === "team" ? "primary" : "ghost"}`} onClick={() => setSource("team")}>Echipă</button>
              <input style={{ flex: 1 }} placeholder="Caută…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, marginBottom: 8 }}>
              <input type="checkbox" checked={allShownPicked} onChange={toggleAllShown} />
              Selectează toți cei afișați ({people.length})
            </label>
            <div className="list" style={{ maxHeight: 360, overflowY: "auto" }}>
              {people.map((p) => (
                <label key={p.email} className="list-row" style={{ gap: 10, alignItems: "center", cursor: "pointer" }}>
                  <input type="checkbox" checked={picked.has(p.email)} onChange={() => toggle(p.email, p.name)} />
                  <div style={{ minWidth: 0 }}>
                    <div className="p-name" style={{ fontSize: 13 }}>{p.name}</div>
                    <div className="faint" style={{ fontSize: 11.5 }}>{p.sub}</div>
                  </div>
                </label>
              ))}
              {people.length === 0 && (
                <div className="empty-note">
                  {source === "clients" ? "Niciun client cu email încă — apar aici cei care se programează." : "Nicio adresă disponibilă."}
                </div>
              )}
            </div>
            <div className="faint" style={{ fontSize: 12, marginTop: 8 }}>{picked.size} selectați</div>
          </div>

          <div className="card">
            <div className="nav-label" style={{ padding: 0, marginBottom: 8 }}>Mesaj</div>
            <div className="field">
              <label>Subiect</label>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div className="field">
              <label>
                Format{" "}
                <select value={isHtml ? "html" : "text"} onChange={(e) => setIsHtml(e.target.value === "html")}>
                  <option value="text">Text simplu</option>
                  <option value="html">HTML</option>
                </select>
              </label>
              <textarea rows={9} style={{ fontFamily: isHtml ? "var(--font-mono)" : undefined, fontSize: 12.5 }} value={body} onChange={(e) => setBody(e.target.value)} placeholder={isHtml ? "<h1>Salut {{nume}}</h1>" : "Salut {{nume}}, …"} />
              <div className="faint" style={{ fontSize: 11.5, marginTop: 4 }}>
                <code>{"{{nume}}"}</code> se înlocuiește cu numele fiecărui destinatar.
              </div>
            </div>
            <div className="nav-label" style={{ padding: 0, margin: "8px 0 6px" }}>Previzualizare</div>
            <Preview subject={subject} body={body} isHtml={isHtml} vars={{ nume: firstName }} />
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
              <button type="button" className="btn primary" disabled={sending || picked.size === 0} onClick={send}>
                {sending ? "Se trimite…" : `Trimite la ${picked.size} ${picked.size === 1 ? "destinatar" : "destinatari"}`}
              </button>
              {sendMsg && <span className="faint" style={{ fontSize: 12.5 }}>{sendMsg}</span>}
            </div>
          </div>
        </div>
      )}

      {tab === "history" && (
        <div className="card" style={{ padding: 0 }}>
          <div style={{ display: "flex", gap: 8, padding: "12px 16px" }}>
            <button type="button" className="btn sm ghost" onClick={refreshOutbox}>Reîmprospătează</button>
            <button type="button" className="btn sm ghost" onClick={async () => { await runQueue(); await refreshOutbox(); }}>Trimite acum ce e în coadă</button>
          </div>
          <table className="table">
            <thead>
              <tr><th>Stare</th><th>Către</th><th>Subiect</th><th>Programat / trimis</th></tr>
            </thead>
            <tbody>
              {outbox.map((o) => (
                <tr key={o.id}>
                  <td><span className={`badge ${STATUS_BADGE[o.status]}`}>{STATUS_LABEL[o.status]}</span></td>
                  <td>
                    <div className="p-name" style={{ fontSize: 13 }}>{o.to_name ?? "—"}</div>
                    <div className="faint" style={{ fontSize: 11.5 }}>{o.to_email}</div>
                  </td>
                  <td>
                    {o.subject}
                    {o.error && <div className="field-error">{o.error}</div>}
                  </td>
                  <td className="faint">{new Date(o.sent_at ?? o.send_at).toLocaleString("ro-RO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                </tr>
              ))}
              {outbox.length === 0 && (
                <tr><td colSpan={4}><div className="empty-note">Niciun email încă.</div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

"use client";

import { Fragment, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Tiny formatter for the guides: "# " section, "## " subsection, "- " bullet, **bold**, blank line = new paragraph.
function inline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? <b key={i}>{part.slice(2, -2)}</b> : <Fragment key={i}>{part}</Fragment>,
  );
}

function Body({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  let bullets: string[] = [];
  const flush = (key: number) => {
    if (bullets.length) {
      blocks.push(
        <ul key={`ul${key}`} style={{ margin: "6px 0 14px", paddingLeft: 22, display: "grid", gap: 4 }}>
          {bullets.map((b, i) => <li key={i} style={{ lineHeight: 1.55 }}>{inline(b)}</li>)}
        </ul>,
      );
      bullets = [];
    }
  };
  text.split("\n").forEach((line, i) => {
    if (line.startsWith("- ")) return void bullets.push(line.slice(2));
    flush(i);
    if (line.startsWith("## ")) blocks.push(<h3 key={i} style={{ fontSize: 15, margin: "18px 0 6px" }}>{inline(line.slice(3))}</h3>);
    else if (line.startsWith("# ")) blocks.push(<h2 key={i} style={{ fontSize: 18, margin: "30px 0 8px", paddingBottom: 6, borderBottom: "1px solid var(--border)" }}>{inline(line.slice(2))}</h2>);
    else if (line.trim()) blocks.push(<p key={i} style={{ margin: "6px 0", lineHeight: 1.6 }}>{inline(line)}</p>);
  });
  flush(blocks.length);
  return <>{blocks}</>;
}

export default function GuideView({ slug, title, initialBody, canEdit }: { slug: string; title: string; initialBody: string; canEdit: boolean }) {
  const supabase = createClient();
  const [body, setBody] = useState(initialBody);
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (draft === null) return;
    setSaving(true);
    setError(null);
    const { error: err } = await supabase.from("guides").update({ body: draft, updated_at: new Date().toISOString() }).eq("slug", slug);
    setSaving(false);
    if (err) return setError(err.message);
    setBody(draft);
    setDraft(null);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{title}</h1>
          <p>{canEdit ? "Poți edita textul. Modificările se văd imediat la toți editorii." : "Citește cu atenție — unele reguli sunt obligatorii."}</p>
        </div>
        {canEdit && draft === null && <button className="btn primary" onClick={() => setDraft(body)}>Editează</button>}
      </div>

      <div className="card" style={{ maxWidth: 860, padding: "8px 28px 28px" }}>
        {draft !== null ? (
          <>
            <p className="faint" style={{ fontSize: 12, margin: "14px 0" }}>
              Format: <code># Titlu secțiune</code>, <code>## Subtitlu</code>, <code>- punct din listă</code>, <code>**text îngroșat**</code>. Rând gol = paragraf nou.
            </p>
            <textarea value={draft} onChange={(e) => setDraft(e.target.value)} style={{ width: "100%", minHeight: "60vh", fontFamily: "inherit", lineHeight: 1.5 }} />
            {error && <div className="field-error">{error}</div>}
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button className="btn primary" onClick={save} disabled={saving}>{saving ? "Se salvează…" : "Salvează"}</button>
              <button className="btn ghost" onClick={() => { setDraft(null); setError(null); }}>Renunță</button>
            </div>
          </>
        ) : body ? (
          <Body text={body} />
        ) : (
          <div className="empty-note" style={{ margin: 24 }}>Încă nu e scris nimic aici.</div>
        )}
      </div>
    </>
  );
}

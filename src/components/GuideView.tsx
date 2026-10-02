"use client";

import { Fragment, useRef, useState } from "react";
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

type BlockType = "h2" | "h3" | "p" | "ul";
type Block = { id: number; type: BlockType; text: string };
const TYPE_LABEL: Record<BlockType, string> = { h2: "Titlu secțiune", h3: "Subtitlu", p: "Text", ul: "Listă (un rând = un punct)" };

let nextId = 1;
function parse(text: string): Block[] {
  const out: Block[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) out.push({ id: nextId++, type: "ul", text: list.join("\n") });
    list = [];
  };
  for (const line of text.split("\n")) {
    if (line.startsWith("- ")) list.push(line.slice(2));
    else {
      flush();
      if (line.startsWith("## ")) out.push({ id: nextId++, type: "h3", text: line.slice(3) });
      else if (line.startsWith("# ")) out.push({ id: nextId++, type: "h2", text: line.slice(2) });
      else if (line.trim()) out.push({ id: nextId++, type: "p", text: line });
    }
  }
  flush();
  return out;
}
function serialize(blocks: Block[]) {
  return blocks
    .filter((b) => b.text.trim())
    .map((b) =>
      b.type === "h2" ? `# ${b.text.trim()}` : b.type === "h3" ? `## ${b.text.trim()}` : b.type === "ul" ? b.text.split("\n").filter((l) => l.trim()).map((l) => `- ${l.trim()}`).join("\n") : b.text.trim(),
    )
    .join("\n\n");
}

function BlockEditor({ blocks, setBlocks }: { blocks: Block[]; setBlocks: React.Dispatch<React.SetStateAction<Block[]>> }) {
  const refs = useRef<Record<number, HTMLTextAreaElement | null>>({});
  const update = (id: number, patch: Partial<Block>) => setBlocks((bs) => bs.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  const move = (i: number, d: number) =>
    setBlocks((bs) => {
      const j = i + d;
      if (j < 0 || j >= bs.length) return bs;
      const copy = bs.slice();
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  const add = (i: number, type: BlockType) => setBlocks((bs) => [...bs.slice(0, i + 1), { id: nextId++, type, text: "" }, ...bs.slice(i + 1)]);
  function bold(b: Block) {
    const el = refs.current[b.id];
    if (!el || el.selectionStart === el.selectionEnd) return;
    const { selectionStart: a, selectionEnd: e } = el;
    update(b.id, { text: `${b.text.slice(0, a)}**${b.text.slice(a, e)}**${b.text.slice(e)}` });
  }
  return (
    <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
      {blocks.map((b, i) => (
        <div key={b.id} className="card" style={{ padding: 10, background: "var(--surface-2)" }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
            <select value={b.type} onChange={(e) => update(b.id, { type: e.target.value as BlockType })} style={{ fontSize: 12 }}>
              {(Object.keys(TYPE_LABEL) as BlockType[]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
            </select>
            {b.type !== "h2" && <button type="button" className="btn sm ghost" title="Selectează un cuvânt, apoi apasă" onClick={() => bold(b)}><b>B</b></button>}
            <span style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
              <button type="button" className="icon-btn" style={{ width: 26, height: 26 }} title="Mută sus" onClick={() => move(i, -1)}>↑</button>
              <button type="button" className="icon-btn" style={{ width: 26, height: 26 }} title="Mută jos" onClick={() => move(i, 1)}>↓</button>
              <button type="button" className="icon-btn" style={{ width: 26, height: 26 }} title="Șterge blocul" onClick={() => setBlocks((bs) => bs.filter((x) => x.id !== b.id))}>✕</button>
            </span>
          </div>
          <textarea
            ref={(el) => { refs.current[b.id] = el; }}
            value={b.text}
            rows={Math.max(b.type === "h2" || b.type === "h3" ? 1 : 2, Math.ceil(b.text.length / 90) + b.text.split("\n").length - 1)}
            onChange={(e) => update(b.id, { text: e.target.value })}
            style={{ width: "100%", fontFamily: "inherit", lineHeight: 1.5, fontWeight: b.type === "h2" || b.type === "h3" ? 700 : 400 }}
            placeholder={TYPE_LABEL[b.type]}
          />
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            <button type="button" className="btn sm ghost" onClick={() => add(i, "p")}>+ Text dedesubt</button>
            <button type="button" className="btn sm ghost" onClick={() => add(i, "ul")}>+ Listă</button>
            <button type="button" className="btn sm ghost" onClick={() => add(i, "h2")}>+ Titlu</button>
          </div>
        </div>
      ))}
      {blocks.length === 0 && <button type="button" className="btn" onClick={() => setBlocks([{ id: nextId++, type: "p", text: "" }])}>+ Adaugă primul bloc</button>}
    </div>
  );
}

export default function GuideView({ slug, title, initialBody, canEdit }: { slug: string; title: string; initialBody: string; canEdit: boolean }) {
  const supabase = createClient();
  const [body, setBody] = useState(initialBody);
  const [blocks, setBlocks] = useState<Block[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (blocks === null) return;
    const next = serialize(blocks);
    setSaving(true);
    setError(null);
    const { error: err } = await supabase.from("guides").update({ body: next, updated_at: new Date().toISOString() }).eq("slug", slug);
    setSaving(false);
    if (err) return setError(err.message);
    setBody(next);
    setBlocks(null);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{title}</h1>
          <p>{canEdit ? "Apasă „Editează” ca să schimbi textul — se vede imediat la toți editorii." : "Citește cu atenție — unele reguli sunt obligatorii."}</p>
        </div>
        {canEdit && blocks === null && <button className="btn primary" onClick={() => setBlocks(parse(body))}>✎ Editează textul</button>}
        {blocks !== null && (
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn ghost" onClick={() => { setBlocks(null); setError(null); }}>Renunță</button>
            <button className="btn primary" onClick={save} disabled={saving}>{saving ? "Se salvează…" : "Salvează"}</button>
          </div>
        )}
      </div>

      <div className="card" style={{ maxWidth: 860, padding: "8px 28px 28px" }}>
        {blocks !== null ? (
          <>
            <p className="faint" style={{ fontSize: 12.5, margin: "14px 0 0" }}>
              Fiecare bucată de text e un bloc. Schimbi tipul (titlu, text, listă), îl muți cu ↑ ↓, îl ștergi cu ✕ sau adaugi altul dedesubt. Pentru text îngroșat: selectezi cuvintele și apeși <b>B</b>.
            </p>
            <BlockEditor blocks={blocks} setBlocks={(u) => setBlocks((prev) => (prev === null ? prev : typeof u === "function" ? u(prev) : u))} />
            {error && <div className="field-error">{error}</div>}
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button className="btn primary" onClick={save} disabled={saving}>{saving ? "Se salvează…" : "Salvează"}</button>
              <button className="btn ghost" onClick={() => { setBlocks(null); setError(null); }}>Renunță</button>
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

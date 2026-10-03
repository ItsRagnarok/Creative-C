"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import { useRealtimeRows } from "@/lib/useRealtimeRows";

export type ProspectRow = Database["public"]["Tables"]["prospects"]["Row"];

const STATUS: Record<string, { label: string; badge: string }> = {
  de_verificat: { label: "De verificat", badge: "gray" },
  calificat: { label: "Calificat", badge: "green" },
  contactat: { label: "Contactat", badge: "blue" },
  respins: { label: "Respins", badge: "red" },
  lead: { label: "Lead", badge: "amber" },
};

// Same rule as the original spreadsheet: fewer Google reviews = smaller business = checked first.
const priority = (r: number | null) => (r == null ? "—" : r < 100 ? "Mare" : r < 300 ? "Medie" : "Mică");
const PRIORITY_BADGE: Record<string, string> = { Mare: "green", Medie: "amber", Mică: "gray", "—": "gray" };
const google = (q: string) => `https://www.google.com/search?q=${encodeURIComponent(q)}`;

// CSV template = the columns of the prospecting spreadsheet, so everyone uploads the same way.
const CSV_COLUMNS = ["Oraș", "Nume firmă", "Categorie", "Adresă", "Telefon", "Rating Google", "Nr. recenzii Google", "Link Google Maps", "Instagram (@cont)", "Note"];
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9@]+/g, " ").trim();
const HEADER_KEYS: Record<string, string> = {
  oras: "city", city: "city",
  "nume firma": "name", nume: "name", firma: "name", name: "name",
  categorie: "category", category: "category",
  adresa: "address", address: "address",
  telefon: "phone", phone: "phone",
  "rating google": "rating", rating: "rating",
  "nr recenzii google": "reviews", "nr recenzii": "reviews", recenzii: "reviews", reviews: "reviews",
  "link google maps": "maps_url", maps: "maps_url", "google maps": "maps_url",
  "instagram @cont": "instagram", instagram: "instagram", cont: "instagram", "@cont": "instagram",
  note: "notes", notite: "notes", notes: "notes",
};

// Small CSV reader: handles quotes, and both "," and ";" (Excel in Romanian saves with ";").
function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const first = src.split(/\r?\n/)[0] ?? "";
  const delim = (first.match(/;/g)?.length ?? 0) >= (first.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === delim) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((x) => x.trim() !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim() !== "")) rows.push(row);
  return rows;
}

export default function ProspectsTable({ initialRows, canDelete }: { initialRows: ProspectRow[]; canDelete: boolean }) {
  const supabase = createClient();
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  useRealtimeRows({ table: "prospects", select: "*", setRows });
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("toate");
  const [category, setCategory] = useState("toate");
  const [status, setStatus] = useState("toate");
  const [prio, setPrio] = useState("toate");
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ city: "", name: "", category: "", phone: "", address: "", maps_url: "" });
  const [msg, setMsg] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const cities = useMemo(() => Array.from(new Set(rows.map((r) => r.city))).sort(), [rows]);
  const categories = useMemo(() => Array.from(new Set(rows.map((r) => r.category).filter(Boolean) as string[])).sort(), [rows]);
  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (!search || r.name.toLowerCase().includes(search.toLowerCase())) &&
          (city === "toate" || r.city === city) &&
          (category === "toate" || r.category === category) &&
          (status === "toate" || r.status === status) &&
          (prio === "toate" || priority(r.reviews) === prio),
      ),
    [rows, search, city, category, status, prio],
  );

  async function patch(id: string, values: Partial<ProspectRow>) {
    setRows((p) => p.map((r) => (r.id === id ? { ...r, ...values } : r)));
    const { error } = await supabase.from("prospects").update(values).eq("id", id);
    if (error) setMsg(error.message);
  }

  async function toLead(r: ProspectRow) {
    const { data, error } = await supabase.rpc("convert_prospect", { p_id: r.id });
    if (error) return setMsg(error.message);
    setRows((p) => p.map((x) => (x.id === r.id ? { ...x, status: "lead", lead_id: data as string } : x)));
    setMsg(`„${r.name}” a devenit lead — îl găsești în Pipeline, coloana „Nou”.`);
    router.refresh();
  }

  async function remove(r: ProspectRow) {
    if (!window.confirm(`Ștergi prospectul „${r.name}”?`)) return;
    const { error } = await supabase.from("prospects").delete().eq("id", r.id);
    if (error) return setMsg(error.message);
    setRows((p) => p.filter((x) => x.id !== r.id));
  }

  function downloadTemplate() {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const example = ["Oradea", "EXEMPLU — șterge acest rând", "Cafenea", "Str. Exemplu 1, Oradea", "+40 700 000 000", "4.8", "120", "https://www.google.com/maps/place/...", "@exemplu", ""];
    const csv = [CSV_COLUMNS, example].map((r) => r.map(esc).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "sablon-prospecti.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importCsv(file: File) {
    setMsg(null);
    setImporting(true);
    try {
      const table = parseCsv(await file.text());
      if (table.length < 2) return setMsg("Fișierul e gol sau nu are rânduri sub antet. Descarcă șablonul și completează-l.");
      const cols = table[0].map((h) => HEADER_KEYS[norm(h)] ?? null);
      if (!cols.includes("name") || !cols.includes("city")) return setMsg('Lipsesc coloanele „Oraș” și „Nume firmă”. Folosește șablonul din butonul „Șablon CSV”.');
      const seen = new Set(rows.map((r) => `${r.name.toLowerCase()}|${r.city.toLowerCase()}`));
      const fresh: Record<string, string | number | null>[] = [];
      let skipped = 0;
      let dup = 0;
      for (const line of table.slice(1)) {
        const rec: Record<string, string> = {};
        cols.forEach((k, i) => { if (k) rec[k] = (line[i] ?? "").trim(); });
        if (!rec.name || !rec.city || rec.name.toUpperCase().startsWith("EXEMPLU")) { skipped++; continue; }
        const key = `${rec.name.toLowerCase()}|${rec.city.toLowerCase()}`;
        if (seen.has(key)) { dup++; continue; }
        seen.add(key);
        const rating = Number(rec.rating?.replace(",", "."));
        const reviews = Number(rec.reviews);
        fresh.push({
          city: rec.city,
          name: rec.name,
          category: rec.category || null,
          address: rec.address || null,
          phone: rec.phone && rec.phone !== "—" ? rec.phone : null,
          rating: rec.rating && Number.isFinite(rating) ? Math.min(9.9, Math.max(0, rating)) : null,
          reviews: rec.reviews && Number.isFinite(reviews) ? Math.max(0, Math.round(reviews)) : null,
          maps_url: rec.maps_url || null,
          instagram: rec.instagram || null,
          notes: rec.notes || null,
        });
      }
      if (fresh.length === 0) return setMsg(`Nimic de importat: ${dup} există deja, ${skipped} rânduri goale sau de exemplu.`);
      const { data, error } = await supabase.from("prospects").insert(fresh as never).select("*");
      if (error) return setMsg(error.message);
      setRows((p) => [...p, ...((data ?? []) as ProspectRow[])]);
      setMsg(`Importate ${fresh.length} firme noi${dup ? `, ${dup} existau deja (sărite)` : ""}${skipped ? `, ${skipped} rânduri ignorate` : ""}.`);
    } finally {
      setImporting(false);
    }
  }

  async function add() {
    if (!draft.name.trim() || !draft.city.trim()) return setMsg("Numele firmei și orașul sunt obligatorii.");
    const clean = Object.fromEntries(Object.entries(draft).map(([k, v]) => [k, v.trim() || null]));
    const { data, error } = await supabase.from("prospects").insert(clean as never).select("*").single();
    if (error) return setMsg(error.code === "23505" ? "Firma asta există deja în același oraș." : error.message);
    setRows((p) => [...p, data as ProspectRow]);
    setDraft({ city: "", name: "", category: "", phone: "", address: "", maps_url: "" });
    setAdding(false);
    setMsg(null);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Prospecți</h1>
          <p>{rows.length} firme găsite de noi, pe care nu le-am contactat încă. Când răspunde cineva, apeși „→ Lead” și trece în Pipeline.</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn ghost" onClick={downloadTemplate} title="Fișier CSV gol, cu coloanele de completat">⬇ Șablon CSV</button>
          <label className="btn ghost" style={{ cursor: importing ? "wait" : "pointer" }} title="Încarcă un CSV completat după șablon">
            {importing ? "Se importă…" : "⬆ Importă CSV"}
            <input
              type="file"
              accept=".csv,text/csv"
              hidden
              disabled={importing}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) importCsv(f);
              }}
            />
          </label>
          <button className="btn primary" onClick={() => setAdding(true)}>+ Prospect</button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14, padding: "10px 18px", fontSize: 12.5 }}>
        <b>Prospect</b> = firmă găsită de noi, încă necontactată → <b>Lead</b> = a răspuns sau s-a programat (Pipeline) → <b>Client</b> = a semnat și lucrăm cu el.
      </div>

      <div className="card" style={{ marginBottom: 14, display: "flex", gap: 10, flexWrap: "wrap", padding: "14px 18px" }}>
        <div className="search" style={{ maxWidth: 240 }}>
          🔍
          <input placeholder="Caută firmă…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select value={city} onChange={(e) => setCity(e.target.value)}>
          <option value="toate">Toate orașele</option>
          {cities.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="toate">Toate categoriile</option>
          {categories.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select value={prio} onChange={(e) => setPrio(e.target.value)}>
          <option value="toate">Orice prioritate</option>
          <option>Mare</option><option>Medie</option><option>Mică</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="toate">Toate statusurile</option>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <span className="faint" style={{ alignSelf: "center", fontSize: 12 }}>{filtered.length} afișate</span>
      </div>
      {msg && <div className="faint" style={{ fontSize: 12.5, marginBottom: 10 }}>{msg}</div>}

      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table className="table">
          <thead>
            <tr>
              <th>Firmă</th><th>Telefon</th><th>Google</th><th>Prior.</th><th>Instagram</th>
              <th>Status</th><th>Note</th><th />
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id}>
                <td style={{ minWidth: 190 }}>
                  <div className="p-name" style={{ fontSize: 13 }}>{r.name}</div>
                  <div className="faint" style={{ fontSize: 11 }}>{r.city}{r.category ? ` · ${r.category}` : ""}</div>
                </td>
                <td>{r.phone ? <a href={`tel:${r.phone.replace(/\s/g, "")}`}>{r.phone}</a> : <span className="faint">—</span>}</td>
                <td style={{ whiteSpace: "nowrap" }}>{r.rating != null ? `⭐ ${r.rating}` : "—"} <span className="faint">({r.reviews ?? 0})</span></td>
                <td><span className={`badge ${PRIORITY_BADGE[priority(r.reviews)]}`}>{priority(r.reviews)}</span></td>
                <td style={{ minWidth: 170 }}>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input
                      style={{ width: 120 }}
                      placeholder="@cont"
                      defaultValue={r.instagram ?? ""}
                      onBlur={(e) => e.target.value.trim() !== (r.instagram ?? "") && patch(r.id, { instagram: e.target.value.trim() || null })}
                    />
                    <a title="Caută pe Google" href={google(`${r.name} ${r.city} instagram`)} target="_blank" rel="noreferrer">🔎</a>
                  </div>
                </td>
                <td>
                  <select value={r.status} disabled={r.status === "lead"} onChange={(e) => patch(r.id, { status: e.target.value })}>
                    {Object.entries(STATUS).filter(([k]) => k !== "lead" || r.status === "lead").map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </td>
                <td><input style={{ width: 150 }} defaultValue={r.notes ?? ""} onBlur={(e) => e.target.value.trim() !== (r.notes ?? "") && patch(r.id, { notes: e.target.value.trim() || null })} /></td>
                <td style={{ whiteSpace: "nowrap" }}>
                  {r.maps_url && <a className="btn sm ghost" href={r.maps_url} target="_blank" rel="noreferrer">Maps</a>}{" "}
                  {r.lead_id ? (
                    <span className="badge amber">în Pipeline</span>
                  ) : (
                    <button type="button" className="btn sm primary" onClick={() => toLead(r)}>→ Lead</button>
                  )}{" "}
                  {canDelete && !r.lead_id && <button type="button" className="icon-btn" style={{ width: 26, height: 26 }} title="Șterge" onClick={() => remove(r)}>✕</button>}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="faint" style={{ textAlign: "center", padding: 24 }}>Niciun prospect pentru filtrele alese.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {adding && (
        <div className="modal-overlay" onClick={() => setAdding(false)}>
          <div className="modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Prospect nou</h3>
              <button className="modal-close" onClick={() => setAdding(false)}>✕</button>
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              <input placeholder="Nume firmă *" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              <input placeholder="Oraș *" list="p-cities" value={draft.city} onChange={(e) => setDraft({ ...draft, city: e.target.value })} />
              <input placeholder="Categorie (ex: Clinică dentară)" list="p-cats" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} />
              <input placeholder="Telefon" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
              <input placeholder="Adresă" value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })} />
              <input placeholder="Link Google Maps" value={draft.maps_url} onChange={(e) => setDraft({ ...draft, maps_url: e.target.value })} />
              <datalist id="p-cities">{cities.map((c) => <option key={c} value={c} />)}</datalist>
              <datalist id="p-cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
              <button type="button" className="btn primary" style={{ justifyContent: "center" }} onClick={add}>Adaugă</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

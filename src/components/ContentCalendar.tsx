"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeRefetch } from "@/lib/useRealtimeRows";

export type CalendarEditor = { id: string; full_name: string; initials: string; role?: string };

export type CalendarRow = {
  id: string;
  editor_id: string;
  day: string;
  clip_type: string;
  status: "de_facut" | "incarcat" | "in_review" | "closed";
  file_name: string | null;
  file_path: string | null;
  file_url: string | null;
  uploaded_at: string | null;
};

const STATUS_LABEL: Record<CalendarRow["status"], string> = {
  de_facut: "De făcut",
  incarcat: "Încărcat",
  in_review: "În review",
  closed: "Closed",
};
const STATUS_BADGE: Record<CalendarRow["status"], string> = {
  de_facut: "gray",
  incarcat: "amber",
  in_review: "blue",
  closed: "green",
};

const pad = (n: number) => String(n).padStart(2, "0");
const monthKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
const dayIso = (month: string, day: number) => `${month}-${pad(day)}`;

function daysIn(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

function monthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("ro-RO", { month: "long", year: "numeric" });
}

function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  return monthKey(new Date(y, m - 1 + delta, 1));
}

function dayLabel(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return {
    num: d.getDate(),
    rest: d.toLocaleDateString("ro-RO", { month: "short", weekday: "short" }),
  };
}

export default function ContentCalendar({
  editors,
  canManage,
  currentUserId,
}: {
  editors: CalendarEditor[];
  canManage: boolean;
  currentUserId: string;
}) {
  const supabase = createClient();
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const [editorId, setEditorId] = useState<string | null>(
    canManage ? editors[0]?.id ?? null : currentUserId,
  );
  const [rows, setRows] = useState<CalendarRow[]>([]);
  const [loading, setLoading] = useState(!!editorId);
  const [error, setError] = useState<string | null>(null);
  const [editingDay, setEditingDay] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [uploadDay, setUploadDay] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadLink, setUploadLink] = useState("");
  const [uploadType, setUploadType] = useState("");
  const [uploading, setUploading] = useState(false);
  const [copyFrom, setCopyFrom] = useState("");

  const fetchMonth = useCallback(
    async (forEditor: string, forMonth: string) =>
      supabase
        .from("content_calendar")
        .select("*")
        .eq("editor_id", forEditor)
        .gte("day", dayIso(forMonth, 1))
        .lte("day", dayIso(forMonth, daysIn(forMonth)))
        .order("day"),
    [supabase],
  );

  useEffect(() => {
    if (!editorId) return;
    let cancelled = false;
    fetchMonth(editorId, month).then(({ data, error: err }) => {
      if (cancelled) return;
      if (err) setError(err.message);
      else setRows((data ?? []) as CalendarRow[]);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [editorId, month, fetchMonth]);

  useRealtimeRefetch("content_calendar", () => {
    if (editorId) fetchMonth(editorId, month).then(({ data }) => data && setRows(data as CalendarRow[]));
  });

  function pick(nextEditor: string, nextMonth: string) {
    setError(null);
    setLoading(true);
    setEditingDay(null);
    setUploadDay(null);
    setEditorId(nextEditor);
    setMonth(nextMonth);
  }

  const byDay = useMemo(() => new Map(rows.map((r) => [r.day, r])), [rows]);
  const editor = editors.find((e) => e.id === editorId) ?? null;
  const otherEditors = editors.filter((e) => e.id !== editorId);

  function patchRow(next: CalendarRow) {
    setRows((prev) => (prev.some((r) => r.id === next.id) ? prev.map((r) => (r.id === next.id ? next : r)) : [...prev, next]));
  }

  async function saveType(iso: string) {
    if (!editorId) return;
    const text = draft.trim();
    const existing = byDay.get(iso);
    setEditingDay(null);
    setError(null);
    if (existing && existing.clip_type === text) return;
    if (!text) {
      if (!existing) return;
      const { error: err } = await supabase.from("content_calendar").delete().eq("id", existing.id);
      if (err) return setError(err.message);
      setRows((prev) => prev.filter((r) => r.id !== existing.id));
      return;
    }
    if (existing) {
      const { data, error: err } = await supabase
        .from("content_calendar")
        .update({ clip_type: text })
        .eq("id", existing.id)
        .select("*")
        .single();
      if (err) return setError(err.message);
      patchRow(data as CalendarRow);
    } else {
      const { data, error: err } = await supabase
        .from("content_calendar")
        .insert({ editor_id: editorId, day: iso, clip_type: text, created_by: currentUserId })
        .select("*")
        .single();
      if (err) return setError(err.message);
      patchRow(data as CalendarRow);
    }
  }

  async function setStatus(row: CalendarRow, status: "in_review" | "closed") {
    setError(null);
    const { data, error: err } = await supabase
      .from("content_calendar")
      .update({ status })
      .eq("id", row.id)
      .select("*")
      .single();
    if (err) return setError(err.message);
    patchRow(data as CalendarRow);
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!uploadDay || !editorId) return;
    const link = uploadLink.trim();
    if (!uploadFile && !link) return setError("Lipește linkul din Drive sau alege un fișier.");
    setUploading(true);
    setError(null);

    // Editors can add a clip on any day of their own calendar; the day's row is created on the first upload.
    let row = byDay.get(uploadDay);
    if (!row) {
      const { data: created, error: createErr } = await supabase
        .from("content_calendar")
        .insert({ editor_id: editorId, day: uploadDay, clip_type: uploadType.trim() || "Clip", created_by: currentUserId })
        .select("*")
        .single();
      if (createErr || !created) {
        setUploading(false);
        return setError(createErr?.message ?? "Nu am putut crea ziua.");
      }
      row = created as CalendarRow;
      patchRow(row);
    }

    let filePath: string | null = null;
    let fileName: string | null = null;
    if (uploadFile) {
      const safe = uploadFile.name.replace(/[^\w.\-]+/g, "_");
      filePath = `${row.editor_id}/${row.day}/${Date.now()}-${safe}`;
      const { error: upErr } = await supabase.storage.from("clips").upload(filePath, uploadFile);
      if (upErr) {
        setUploading(false);
        return setError(upErr.message);
      }
      fileName = uploadFile.name;
    }
    const { data, error: err } = await supabase
      .from("content_calendar")
      .update({
        file_path: filePath,
        file_name: fileName ?? (link ? "Link Drive" : null),
        file_url: link || null,
        status: "incarcat",
        uploaded_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .select("*")
      .single();
    setUploading(false);
    if (err) return setError(err.message);
    patchRow(data as CalendarRow);
    setUploadDay(null);
    setUploadFile(null);
    setUploadLink("");
    setUploadType("");
  }

  async function download(row: CalendarRow) {
    if (row.file_path) {
      const { data, error: err } = await supabase.storage.from("clips").createSignedUrl(row.file_path, 3600);
      if (err || !data) return setError(err?.message ?? "Nu am putut deschide fișierul.");
      window.open(data.signedUrl, "_blank", "noopener");
    } else if (row.file_url) {
      window.open(row.file_url, "_blank", "noopener");
    }
  }

  async function copyMonth() {
    if (!editorId || !copyFrom) return;
    setError(null);
    const { data: src, error: err } = await supabase
      .from("content_calendar")
      .select("day, clip_type")
      .eq("editor_id", copyFrom)
      .gte("day", dayIso(month, 1))
      .lte("day", dayIso(month, daysIn(month)));
    if (err) return setError(err.message);
    const missing = (src ?? []).filter((s) => !byDay.has(s.day));
    if (missing.length === 0) return setError("Nu e nimic de copiat: luna sursă e goală sau zilele sunt deja completate.");
    const { error: insErr } = await supabase
      .from("content_calendar")
      .insert(missing.map((s) => ({ editor_id: editorId, day: s.day, clip_type: s.clip_type, created_by: currentUserId })));
    if (insErr) return setError(insErr.message);
    setCopyFrom("");
    const { data, error: reErr } = await fetchMonth(editorId, month);
    if (reErr) setError(reErr.message);
    else setRows((data ?? []) as CalendarRow[]);
  }

  if (!canManage && editors.length === 0) {
    return <div className="empty-note">Nu ai un calendar încă.</div>;
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Calendar content</h1>
          <p>
            {canManage
              ? "Scrii pentru fiecare zi ce clip trebuie făcut; editorul îl vede, încarcă clipul, iar tu îl treci în review și apoi closed."
              : "Vezi ce clip ai de făcut în fiecare zi și încarci aici rezultatul."}
          </p>
        </div>
      </div>

      <div className="chat-shell no-side" style={{ gridTemplateColumns: canManage ? undefined : "1fr" }}>
        {canManage && (
          <div className="chan-list">
            <div className="nav-label" style={{ padding: "4px 10px" }}>Editori</div>
            {editors.map((ed) => (
              <button key={ed.id} className={`chan-item${editorId === ed.id ? " active" : ""}`} onClick={() => pick(ed.id, month)}>
                <span className="status-dot" style={{ background: "var(--accent-2)" }} />
                {ed.full_name}
              </button>
            ))}
            {editors.length === 0 && <div className="empty-note">Niciun editor. Adaugă unul din Echipă.</div>}
          </div>
        )}

        <div className="chat-main" style={{ padding: 18 }}>
          {editorId ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
                <button type="button" className="btn sm ghost" onClick={() => pick(editorId, shiftMonth(month, -1))} aria-label="Luna anterioară">‹</button>
                <b style={{ textTransform: "capitalize", minWidth: 130, textAlign: "center" }}>{monthLabel(month)}</b>
                <button type="button" className="btn sm ghost" onClick={() => pick(editorId, shiftMonth(month, 1))} aria-label="Luna următoare">›</button>
                {canManage && editor && <span className="faint" style={{ marginLeft: 8 }}>{editor.full_name}</span>}
                {canManage && otherEditors.length > 0 && (
                  <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                    <select value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)} style={{ fontSize: 12 }}>
                      <option value="">Copiază luna de la…</option>
                      {otherEditors.map((ed) => (
                        <option key={ed.id} value={ed.id}>{ed.full_name}</option>
                      ))}
                    </select>
                    <button type="button" className="btn sm ghost" disabled={!copyFrom} onClick={copyMonth}>Copiază</button>
                  </div>
                )}
              </div>

              {error && <div className="field-error" style={{ marginBottom: 10 }}>{error}</div>}

              <div className="list">
                <div
                  className="faint"
                  style={{ display: "grid", gridTemplateColumns: "72px minmax(120px,1fr) minmax(160px,1.3fr) minmax(190px,auto)", gap: 12, padding: "0 4px 8px", fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em" }}
                >
                  <span>Zi</span>
                  <span>Tip clip</span>
                  <span>Link clip</span>
                  <span>Status</span>
                </div>
                {Array.from({ length: daysIn(month) }, (_, i) => {
                  const iso = dayIso(month, i + 1);
                  const row = byDay.get(iso);
                  const lbl = dayLabel(iso);
                  const hasFile = !!(row?.file_path || row?.file_url);
                  return (
                    <div
                      key={iso}
                      className="list-row"
                      style={{ display: "grid", gridTemplateColumns: "72px minmax(120px,1fr) minmax(160px,1.3fr) minmax(190px,auto)", gap: 12, alignItems: "center" }}
                    >
                      <div>
                        <b>{lbl.num}</b> <span className="faint" style={{ fontSize: 11 }}>{lbl.rest}</span>
                      </div>

                      {/* Tip clip */}
                      <div style={{ minWidth: 0 }}>
                        {canManage && editingDay === iso ? (
                          <input
                            autoFocus
                            value={draft}
                            placeholder="ex: fake podcast, news…"
                            onChange={(e) => setDraft(e.target.value)}
                            onBlur={() => saveType(iso)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") e.currentTarget.blur();
                              if (e.key === "Escape") setEditingDay(null);
                            }}
                            style={{ width: "100%" }}
                          />
                        ) : canManage ? (
                          <button
                            type="button"
                            className="btn ghost sm"
                            style={{ border: "none", padding: "4px 6px", textAlign: "left", background: "none" }}
                            onClick={() => { setDraft(row?.clip_type ?? ""); setEditingDay(iso); }}
                          >
                            {row ? row.clip_type : <span className="faint">+ tip clip</span>}
                          </button>
                        ) : row ? (
                          <span style={{ fontWeight: 600 }}>{row.clip_type}</span>
                        ) : (
                          <span className="faint">—</span>
                        )}
                      </div>

                      {/* Link clip — visible to everyone with access; only the editor adds/changes it */}
                      <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        {row && hasFile && (
                          row.file_url ? (
                            <a href={row.file_url} target="_blank" rel="noreferrer" style={{ color: "var(--accent-2)", fontSize: 12.5, overflowWrap: "anywhere" }}>
                              🔗 {row.file_url.replace(/^https?:\/\//, "").slice(0, 38)}{row.file_url.length > 45 ? "…" : ""}
                            </a>
                          ) : (
                            <button type="button" className="btn sm ghost" style={{ padding: "2px 8px" }} onClick={() => download(row)}>
                              📁 {row.file_name ?? "Clip"}
                            </button>
                          )
                        )}
                        {row && !hasFile && <span className="faint" style={{ fontSize: 12 }}>— fără link încă</span>}
                        {!canManage && row?.status !== "closed" && (
                          <button type="button" className="btn sm" onClick={() => { setError(null); setUploadType(""); setUploadDay(iso); }}>
                            {hasFile ? "Schimbă link" : row ? "Adaugă link clip" : "+ Adaugă clip"}
                          </button>
                        )}
                      </div>

                      {/* Status — admin S / admin / managers change it */}
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        {row ? (
                          <>
                            <span className={`badge ${STATUS_BADGE[row.status]}`}>{STATUS_LABEL[row.status]}</span>
                            {canManage && (
                              <>
                                <button type="button" className="btn sm ghost" disabled={!hasFile || row.status === "in_review"} onClick={() => setStatus(row, "in_review")}>
                                  În review
                                </button>
                                <button type="button" className="btn sm primary" disabled={!hasFile || row.status === "closed"} onClick={() => setStatus(row, "closed")}>
                                  Closed
                                </button>
                              </>
                            )}
                          </>
                        ) : (
                          <span className="faint">—</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {loading && <div className="faint" style={{ marginTop: 10 }}>Se încarcă…</div>}
            </>
          ) : (
            <div className="empty-note">Alege un editor.</div>
          )}
        </div>
      </div>

      {uploadDay && (
        <div className="modal-overlay" onClick={() => setUploadDay(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Încarcă clip — {dayLabel(uploadDay).num} {dayLabel(uploadDay).rest}</h3>
              <button className="modal-close" onClick={() => setUploadDay(null)}>✕</button>
            </div>
            <form onSubmit={handleUpload}>
              {byDay.get(uploadDay) ? (
                <p className="faint" style={{ marginBottom: 10, fontSize: 12 }}>{byDay.get(uploadDay)?.clip_type}</p>
              ) : (
                <div className="field">
                  <label>Tip clip (opțional)</label>
                  <input value={uploadType} onChange={(e) => setUploadType(e.target.value)} placeholder="ex: fake podcast, news…" />
                </div>
              )}
              <div className="field">
                <label>Link clip (Google Drive)</label>
                <input autoFocus value={uploadLink} onChange={(e) => setUploadLink(e.target.value)} placeholder="Lipește aici linkul din Drive" />
              </div>
              <div className="field">
                <label>sau încarcă fișierul direct (opțional)</label>
                <input type="file" accept="video/*,image/*" onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)} />
              </div>
              {error && <div className="field-error">{error}</div>}
              <button type="submit" className="btn primary" style={{ width: "100%", justifyContent: "center", marginTop: 6 }} disabled={uploading}>
                {uploading ? "Se încarcă…" : "Trimite spre verificare"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

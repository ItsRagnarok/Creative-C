"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeRefetch } from "@/lib/useRealtimeRows";

export type SheetRow = { id: string; editor_id: string; client_name: string; lead_id: string | null; created_at: string };
type LeadOption = { id: string; name: string; editor_pay: number };
type PenaltyDay = { day: string; expected: number; uploaded: number; missing: number; penalty: number };

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
  extra_url: string | null;
  sheet_id: string;
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
  const [sheets, setSheets] = useState<SheetRow[]>([]);
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [dupOpen, setDupOpen] = useState(false);
  const [dupEditor, setDupEditor] = useState("");
  const [dupName, setDupName] = useState("");
  const [clientDraft, setClientDraft] = useState<string | null>(null);
  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [penalties, setPenalties] = useState<PenaltyDay[]>([]);
  const [showPenalties, setShowPenalties] = useState(false);

  const fetchSheets = useCallback(
    async (forEditor: string) =>
      supabase.from("calendar_sheets").select("*").eq("editor_id", forEditor).order("created_at"),
    [supabase],
  );

  const fetchMonth = useCallback(
    async (forSheet: string, forMonth: string) =>
      supabase
        .from("content_calendar")
        .select("*")
        .eq("sheet_id", forSheet)
        .gte("day", dayIso(forMonth, 1))
        .lte("day", dayIso(forMonth, daysIn(forMonth)))
        .order("day"),
    [supabase],
  );

  // The editor's calendars (one per client). Re-read on any change, so a calendar made by a manager shows up live.
  const loadSheets = useCallback(
    (forEditor: string) =>
      fetchSheets(forEditor).then(({ data, error: err }) => {
        if (err) return setError(err.message);
        const list = (data ?? []) as SheetRow[];
        setSheets(list);
        setSheetId((cur) => (cur && list.some((x) => x.id === cur) ? cur : list[0]?.id ?? null));
        if (list.length === 0) setLoading(false);
      }),
    [fetchSheets],
  );

  useEffect(() => {
    if (!editorId) return;
    let cancelled = false;
    fetchSheets(editorId).then(({ data, error: err }) => {
      if (cancelled) return;
      if (err) return setError(err.message);
      const list = (data ?? []) as SheetRow[];
      setSheets(list);
      setSheetId((cur) => (cur && list.some((x) => x.id === cur) ? cur : list[0]?.id ?? null));
      if (list.length === 0) {
        setRows([]);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [editorId, fetchSheets]);

  useEffect(() => {
    if (!sheetId) return;
    let cancelled = false;
    fetchMonth(sheetId, month).then(({ data, error: err }) => {
      if (cancelled) return;
      if (err) setError(err.message);
      else setRows((data ?? []) as CalendarRow[]);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [sheetId, month, fetchMonth]);

  useRealtimeRefetch("content_calendar", () => {
    if (sheetId) fetchMonth(sheetId, month).then(({ data }) => data && setRows(data as CalendarRow[]));
  });
  useRealtimeRefetch("calendar_sheets", () => {
    if (editorId) loadSheets(editorId);
  });

  function pick(nextEditor: string, nextMonth: string) {
    setError(null);
    setLoading(true);
    setEditingDay(null);
    setUploadDay(null);
    if (nextEditor !== editorId) {
      setSheets([]);
      setSheetId(null);
      setRows([]);
    }
    setClientDraft(null);
    setEditorId(nextEditor);
    setMonth(nextMonth);
  }

  // Clients from the CRM: managers pick from all of them; an editor only needs the pay of the clients their calendars are tied to.
  const leadKey = canManage ? "all" : sheets.map((x) => x.lead_id ?? "").join(",");
  useEffect(() => {
    let cancelled = false;
    const q = supabase.from("leads").select("id, name, editor_pay").order("name");
    const ids = sheets.map((x) => x.lead_id).filter(Boolean) as string[];
    if (!canManage && ids.length === 0) return;
    (canManage ? q : q.in("id", ids)).then(({ data }) => {
      if (!cancelled) setLeads((data ?? []) as LeadOption[]);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadKey, canManage, supabase]);

  // 25 lei for every planned clip not uploaded by 17:00 on its day — computed in the database.
  useEffect(() => {
    if (!editorId) return;
    let cancelled = false;
    supabase.rpc("editor_penalties", { p_editor: editorId, p_month: `${month}-01` }).then(({ data }) => {
      if (!cancelled) setPenalties((data ?? []) as PenaltyDay[]);
    });
    return () => {
      cancelled = true;
    };
  }, [editorId, month, rows, supabase]);

  const basePay = sheets.reduce((sum, x) => sum + Number(leads.find((l) => l.id === x.lead_id)?.editor_pay ?? 0), 0);
  const penaltyTotal = penalties.reduce((sum, d) => sum + d.penalty, 0);

  async function linkClient(leadId: string) {
    if (!sheet) return;
    const lead = leads.find((l) => l.id === leadId) ?? null;
    const patch = { lead_id: lead?.id ?? null, ...(lead ? { client_name: lead.name } : {}) };
    setSheets((p) => p.map((x) => (x.id === sheet.id ? { ...x, ...patch } : x)));
    const { error: err } = await supabase.from("calendar_sheets").update(patch).eq("id", sheet.id);
    if (err) setError(err.message);
  }

  function pickSheet(id: string) {
    setError(null);
    setLoading(true);
    setEditingDay(null);
    setUploadDay(null);
    setClientDraft(null);
    setSheetId(id);
  }

  const sheet = sheets.find((x) => x.id === sheetId) ?? null;
  const sheetLabel = (x: SheetRow, i: number) => x.client_name.trim() || `Calendar ${i + 1}`;

  async function newSheet() {
    if (!editorId) return;
    setError(null);
    const { data, error: err } = await supabase.from("calendar_sheets").insert({ editor_id: editorId, created_by: currentUserId }).select("*").single();
    if (err) return setError(err.message);
    setSheets((p) => [...p, data as SheetRow]);
    pickSheet((data as SheetRow).id);
  }

  async function saveClientName() {
    if (!sheet || clientDraft === null) return;
    const name = clientDraft.trim();
    setClientDraft(null);
    if (name === sheet.client_name) return;
    setSheets((p) => p.map((x) => (x.id === sheet.id ? { ...x, client_name: name } : x)));
    const { error: err } = await supabase.from("calendar_sheets").update({ client_name: name }).eq("id", sheet.id);
    if (err) setError(err.message);
  }

  async function removeSheet() {
    if (!sheet) return;
    if (!window.confirm(`Ștergi calendarul „${sheet.client_name || "fără nume"}” cu toate zilele, clipurile și linkurile din el?`)) return;
    const { error: err } = await supabase.from("calendar_sheets").delete().eq("id", sheet.id);
    if (err) return setError(err.message);
    const rest = sheets.filter((x) => x.id !== sheet.id);
    setSheets(rest);
    setRows([]);
    setSheetId(rest[0]?.id ?? null);
    if (rest.length === 0) setLoading(false);
  }

  // Duplicate: same days and clip types in a fresh calendar (for the same or another editor); files, links and statuses start empty.
  async function duplicate() {
    if (!sheet) return;
    const target = dupEditor || sheet.editor_id;
    setError(null);
    const { data: src, error: srcErr } = await supabase.from("content_calendar").select("day, clip_type").eq("sheet_id", sheet.id);
    if (srcErr) return setError(srcErr.message);
    const { data: created, error: err } = await supabase
      .from("calendar_sheets")
      .insert({ editor_id: target, client_name: dupName.trim(), created_by: currentUserId })
      .select("*")
      .single();
    if (err || !created) return setError(err?.message ?? "Nu am putut crea calendarul.");
    if ((src ?? []).length > 0) {
      const { error: insErr } = await supabase
        .from("content_calendar")
        .insert((src ?? []).map((r) => ({ sheet_id: (created as SheetRow).id, editor_id: target, day: r.day, clip_type: r.clip_type, created_by: currentUserId })));
      if (insErr) return setError(insErr.message);
    }
    setDupOpen(false);
    setDupName("");
    setDupEditor("");
    if (target === editorId) {
      setSheets((p) => [...p, created as SheetRow]);
      pickSheet((created as SheetRow).id);
    } else {
      pick(target, month);
    }
  }

  const byDay = useMemo(() => new Map(rows.map((r) => [r.day, r])), [rows]);
  const editor = editors.find((e) => e.id === editorId) ?? null;

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
        .insert({ sheet_id: sheetId!, editor_id: editorId, day: iso, clip_type: text, created_by: currentUserId })
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
        .insert({ sheet_id: sheetId!, editor_id: editorId, day: uploadDay, clip_type: uploadType.trim() || "Clip", created_by: currentUserId })
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
    // The link and the uploaded file are independent: adding one never removes the other.
    const { data, error: err } = await supabase
      .from("content_calendar")
      .update({
        file_path: filePath ?? row.file_path,
        file_name: fileName ?? row.file_name,
        file_url: link || row.file_url,
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
    if (!row.file_path) return;
    const { data, error: err } = await supabase.storage.from("clips").createSignedUrl(row.file_path, 3600, { download: row.file_name ?? true });
    if (err || !data) return setError(err?.message ?? "Nu am putut descărca fișierul.");
    window.location.assign(data.signedUrl);
  }

  // Extra projects link: editors and managers can both add/change it, on any day.
  async function saveExtra(iso: string, value: string) {
    if (!sheetId || !editorId) return;
    const url = value.trim() || null;
    const existing = byDay.get(iso);
    if (existing && (existing.extra_url ?? null) === url) return;
    setError(null);
    if (existing) {
      const { data, error: err } = await supabase.from("content_calendar").update({ extra_url: url }).eq("id", existing.id).select("*").single();
      if (err) return setError(err.message);
      patchRow(data as CalendarRow);
    } else if (url) {
      const { data, error: err } = await supabase
        .from("content_calendar")
        .insert({ sheet_id: sheetId, editor_id: editorId, day: iso, clip_type: "Clip", extra_url: url, created_by: currentUserId })
        .select("*")
        .single();
      if (err) return setError(err.message);
      patchRow(data as CalendarRow);
    }
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
              </div>

              {/* Monthly pay for this editor: what the linked clients pay minus the 17:00 penalties */}
              <div className="card" style={{ padding: "12px 16px", marginBottom: 14, background: "var(--surface-2)" }}>
                <div style={{ display: "flex", gap: 18, alignItems: "baseline", flexWrap: "wrap" }}>
                  <div><div className="faint" style={{ fontSize: 11 }}>PLATĂ EDITOR — {monthLabel(month).toUpperCase()}</div><b style={{ fontSize: 18 }}>{basePay.toLocaleString("ro-RO")} lei</b></div>
                  <div><div className="faint" style={{ fontSize: 11 }}>PENALIZĂRI</div><b style={{ fontSize: 18, color: penaltyTotal ? "var(--danger)" : undefined }}>{penaltyTotal ? `−${penaltyTotal}` : "0"} lei</b></div>
                  <div><div className="faint" style={{ fontSize: 11 }}>DE PLĂTIT</div><b style={{ fontSize: 18 }}>{(basePay - penaltyTotal).toLocaleString("ro-RO")} lei</b></div>
                  {penalties.length > 0 && (
                    <button type="button" className="btn sm ghost" style={{ marginLeft: "auto" }} onClick={() => setShowPenalties((v) => !v)}>
                      {showPenalties ? "Ascunde detaliile" : "Vezi detaliile"}
                    </button>
                  )}
                </div>
                <div className="faint" style={{ fontSize: 11.5, marginTop: 6 }}>
                  Regulă: pentru fiecare clip planificat și neîncărcat până la ora 17:00 din ziua lui, se scad 25 lei.
                </div>
                {showPenalties && (
                  <div style={{ marginTop: 8, display: "grid", gap: 4, fontSize: 12.5 }}>
                    {penalties.map((d) => (
                      <div key={d.day}>
                        {new Date(d.day + "T00:00:00").toLocaleDateString("ro-RO", { day: "numeric", month: "short" })}: {d.uploaded} din {d.expected} clipuri încărcate până la 17:00 → <b style={{ color: "var(--danger)" }}>−{d.penalty} lei</b>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* One calendar per client: switch, name, add, duplicate, delete */}
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
                {sheets.map((x, i) => (
                  <button key={x.id} type="button" className={`btn sm ${x.id === sheetId ? "primary" : "ghost"}`} onClick={() => pickSheet(x.id)}>
                    {sheetLabel(x, i)}
                  </button>
                ))}
                {canManage && (
                  <button type="button" className="btn sm ghost" onClick={newSheet}>+ Calendar nou</button>
                )}
              </div>
              {sheet && (
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
                  <span className="faint" style={{ fontSize: 12 }}>Client:</span>
                  {canManage && (
                    <select value={sheet.lead_id ?? ""} onChange={(e) => linkClient(e.target.value)} style={{ maxWidth: 220 }} title="Leagă calendarul de un client din CRM (plata editorului se ia de acolo)">
                      <option value="">— alege din CRM —</option>
                      {leads.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                  )}
                  {canManage ? (
                    <input
                      style={{ minWidth: 220 }}
                      placeholder="Numele clientului (ex: Clinica Smile)"
                      value={clientDraft ?? sheet.client_name}
                      onChange={(e) => setClientDraft(e.target.value)}
                      onBlur={saveClientName}
                      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                    />
                  ) : (
                    <b>{sheet.client_name || "—"}</b>
                  )}
                  {canManage && (
                    <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                      <button type="button" className="btn sm ghost" onClick={() => { setDupEditor(sheet.editor_id); setDupName(""); setDupOpen(true); }}>⧉ Duplică calendarul</button>
                      <button type="button" className="btn sm ghost" onClick={removeSheet}>Șterge calendarul</button>
                    </span>
                  )}
                </div>
              )}
              {!sheet && !loading && (
                <div className="empty-note" style={{ margin: "10px 0 18px" }}>
                  {canManage ? "Editorul nu are încă niciun calendar. Apasă „+ Calendar nou”." : "Nu ai încă un calendar. Managerul ți-l creează."}
                </div>
              )}

              {error && <div className="field-error" style={{ marginBottom: 10 }}>{error}</div>}

              <div className="list" style={{ display: sheet ? undefined : "none" }}>
                <div
                  className="faint"
                  style={{ display: "grid", gridTemplateColumns: "72px minmax(110px,1fr) minmax(160px,1.3fr) minmax(150px,1fr) minmax(190px,auto)", gap: 12, padding: "0 4px 8px", fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em" }}
                >
                  <span>Zi</span>
                  <span>Tip clip</span>
                  <span>Link / fișier</span>
                  <span>Extra proiecte</span>
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
                      style={{ display: "grid", gridTemplateColumns: "72px minmax(110px,1fr) minmax(160px,1.3fr) minmax(150px,1fr) minmax(190px,auto)", gap: 12, alignItems: "center" }}
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
                        {row?.file_url && (
                          <a href={row.file_url} target="_blank" rel="noreferrer" style={{ color: "var(--accent-2)", fontSize: 12.5, overflowWrap: "anywhere" }}>
                            🔗 {row.file_url.replace(/^https?:\/\//, "").slice(0, 38)}{row.file_url.length > 45 ? "…" : ""}
                          </a>
                        )}
                        {row?.file_path && (
                          <button type="button" className="btn sm ghost" style={{ padding: "2px 8px" }} title="Descarcă fișierul" onClick={() => download(row)}>
                            ⬇ {row.file_name ?? "Fișier"}
                          </button>
                        )}
                        {row && !hasFile && <span className="faint" style={{ fontSize: 12 }}>— fără link încă</span>}
                        {!canManage && row?.status !== "closed" && (
                          <button type="button" className="btn sm" onClick={() => { setError(null); setUploadType(""); setUploadDay(iso); }}>
                            {hasFile ? "Schimbă / adaugă" : row ? "Adaugă link sau fișier" : "+ Adaugă clip"}
                          </button>
                        )}
                      </div>

                      {/* Extra proiecte — a second link, editable by editor and manager */}
                      <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 6 }}>
                        <input
                          key={`${row?.id ?? iso}-${row?.extra_url ?? ""}`}
                          style={{ width: "100%", fontSize: 12.5 }}
                          placeholder="+ link"
                          defaultValue={row?.extra_url ?? ""}
                          onBlur={(e) => saveExtra(iso, e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                        />
                        {row?.extra_url && <a href={row.extra_url} target="_blank" rel="noreferrer" title="Deschide linkul">↗</a>}
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

      {dupOpen && sheet && (
        <div className="modal-overlay" onClick={() => setDupOpen(false)}>
          <div className="modal" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Duplică calendarul</h3>
              <button className="modal-close" onClick={() => setDupOpen(false)}>✕</button>
            </div>
            <p className="faint" style={{ fontSize: 12.5, marginBottom: 12 }}>
              Se copiază zilele și tipurile de clip într-un calendar nou. Fișierele, linkurile și statusurile pornesc goale.
            </p>
            <div className="field">
              <label>Numele clientului (calendarul nou)</label>
              <input autoFocus value={dupName} onChange={(e) => setDupName(e.target.value)} placeholder="ex: Clinica Smile" />
            </div>
            <div className="field">
              <label>Pentru editorul</label>
              <select value={dupEditor} onChange={(e) => setDupEditor(e.target.value)}>
                {editors.map((ed) => <option key={ed.id} value={ed.id}>{ed.full_name}</option>)}
              </select>
            </div>
            {error && <div className="field-error">{error}</div>}
            <button type="button" className="btn primary" style={{ width: "100%", justifyContent: "center" }} onClick={duplicate}>Duplică</button>
          </div>
        </div>
      )}

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
                <label>Fișier (opțional) — clip, imagine, document, orice</label>
                <input type="file" onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)} />
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

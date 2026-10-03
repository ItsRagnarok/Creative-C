"use client";

import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Owner } from "@/components/PipelineBoard";
import { MESSAGE_SELECT } from "@/lib/selects";
import { useRealtimeRows, useRealtimeRefetch } from "@/lib/useRealtimeRows";
import { EditoriTabContext } from "@/components/EditoriTabs";
import { setActiveChat } from "@/lib/activeChat";

export type ChannelRow = {
  id: string;
  slug: string;
  label: string;
  kind: "editor" | "automat";
  editor_id: string | null;
  deadline_note: string | null;
  editor: Owner | null;
};

export type MessageRow = {
  id: string;
  channel_id: string;
  author_id: string | null;
  body: string;
  file_name: string | null;
  file_url: string | null;
  created_at: string;
  author: Owner | null;
};

export type ClipStockRow = {
  editor_id: string;
  clips_remaining: number;
  clips_total: number;
};

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" });
}

function fmtMsgDate(iso: string, today: Date) {
  const d = new Date(iso);
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay ? `azi, ${fmtTime(iso)}` : `${d.toLocaleDateString("ro-RO", { day: "numeric", month: "short" })}, ${fmtTime(iso)}`;
}

export default function ChannelsBoard({
  channels,
  initialMessages,
  initialStock,
  canManage,
  currentUserId,
}: {
  channels: ChannelRow[];
  initialMessages: MessageRow[];
  initialStock: ClipStockRow[];
  canManage: boolean;
  currentUserId: string;
}) {
  const supabase = createClient();
  const [messages, setMessages] = useState(initialMessages);
  const [stock, setStock] = useState(initialStock);
  const [messageInput, setMessageInput] = useState("");
  const [attaching, setAttaching] = useState(false);
  const [fileName, setFileName] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [sending, setSending] = useState(false);
  const [stockDraft, setStockDraft] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState(0);

  const ownChannel = channels.find((c) => c.editor_id === currentUserId) ?? null;
  const [activeId, setActiveIdState] = useState<string | null>(ownChannel?.id ?? channels[0]?.id ?? null);
  const [unread, setUnread] = useState<Record<string, number>>({});
  const { tab, setChatUnread } = useContext(EditoriTabContext);
  const tabRef = useRef(tab);
  const activeIdRef = useRef(activeId);
  const endRef = useRef<HTMLDivElement>(null);

  function setActiveId(id: string | null) {
    activeIdRef.current = id;
    if (tabRef.current === "chat") setActiveChat(id);
    setActiveIdState(id);
    if (id) setUnread((u) => ({ ...u, [id]: 0 }));
  }

  // Live: new messages from anyone appear instantly (RLS decides which ones this user receives).
  useRealtimeRows<MessageRow>({
    table: "channel_messages",
    select: MESSAGE_SELECT,
    setRows: setMessages,
    onChange: (m, event) => {
      if (event === "INSERT" && m.author_id !== currentUserId && (m.channel_id !== activeIdRef.current || tabRef.current !== "chat")) {
        setUnread((u) => ({ ...u, [m.channel_id]: (u[m.channel_id] ?? 0) + 1 }));
      }
    },
  });

  const [today] = useState(() => new Date());

  // Back on the Canale tab: the open channel counts as read. The tab bar mirrors the total unread count.
  useEffect(() => {
    tabRef.current = tab;
    setActiveChat(tab === "chat" ? activeIdRef.current : null);
    if (tab === "chat" && activeIdRef.current) setUnread((u) => (u[activeIdRef.current!] ? { ...u, [activeIdRef.current!]: 0 } : u));
  }, [tab]);
  useEffect(() => () => setActiveChat(null), []);
  useEffect(() => {
    setChatUnread(Object.values(unread).reduce((a, b) => a + b, 0));
  }, [unread, setChatUnread]);

  const active = channels.find((c) => c.id === activeId) ?? null;
  const activeMessages = useMemo(
    () => messages.filter((m) => m.channel_id === activeId).sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [messages, activeId],
  );

  const isGroup = !!active && active.kind === "editor" && !active.editor_id;
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [activeMessages.length, activeId]);

  const canPost = !!active && (canManage || active.editor_id === currentUserId || isGroup);

  const activeStock = active?.editor_id ? stock.find((s) => s.editor_id === active.editor_id) ?? null : null;

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!active || !messageInput.trim()) return;
    setSending(true);
    const { data, error } = await supabase
      .from("channel_messages")
      .insert({
        channel_id: active.id,
        author_id: currentUserId,
        body: messageInput.trim(),
        file_name: fileName.trim() || null,
        file_url: fileUrl.trim() || null,
      })
      .select(MESSAGE_SELECT)
      .single();
    setSending(false);
    if (error) return;
    setMessages((prev) => (prev.some((m) => m.id === (data as MessageRow).id) ? prev : [...prev, data as MessageRow]));
    setMessageInput("");
    setFileName("");
    setFileUrl("");
    setAttaching(false);
  }

  // Clips this editor has uploaded this month (a file or a link on any calendar day) — counted automatically, starts at 0.
  const countUploaded = (editorId: string) => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
    return supabase
      .from("content_calendar")
      .select("id", { count: "exact", head: true })
      .eq("editor_id", editorId)
      .gte("day", iso(start))
      .lt("day", iso(next))
      .or("file_path.not.is.null,file_url.not.is.null");
  };
  const stockEditorId = active?.editor_id ?? null;
  useEffect(() => {
    if (!stockEditorId) return;
    let cancelled = false;
    countUploaded(stockEditorId).then(({ count }) => {
      if (!cancelled) setUploaded(count ?? 0);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stockEditorId]);
  useRealtimeRefetch("content_calendar", () => {
    if (stockEditorId) countUploaded(stockEditorId).then(({ count }) => setUploaded(count ?? 0));
  });

  // One number, set by the manager: how many clips this editor has to do this month.
  async function saveStock() {
    if (!active?.editor_id || stockDraft === null) return;
    const total = Math.max(0, Math.round(Number(stockDraft)) || 0);
    const { data, error } = await supabase
      .from("editor_clip_stock")
      .upsert({ editor_id: active.editor_id, clips_remaining: total, clips_total: total })
      .select("*")
      .single();
    if (error) return;
    setStock((prev) => {
      const existing = prev.find((s) => s.editor_id === active.editor_id);
      if (existing) return prev.map((s) => (s.editor_id === active.editor_id ? (data as ClipStockRow) : s));
      return [...prev, data as ClipStockRow];
    });
    setStockDraft(null);
  }

  const showSide = !!active && active.kind === "editor" && !!active.editor_id;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Canale</h1>
          <p>Chat de grup cu toți editorii și chat privat între manager și fiecare editor.</p>
        </div>
      </div>

      <div className={`chat-shell chat-fixed${showSide ? "" : " no-side"}`}>
        <div className="chan-list">
          <div className="nav-label" style={{ padding: "4px 10px" }}>General</div>
          {channels.filter((c) => c.kind === "editor" && !c.editor_id).map((c) => (
            <button key={c.id} className={`chan-item${activeId === c.id ? " active" : ""}`} onClick={() => setActiveId(c.id)}>
              {c.label}
              {unread[c.id] ? <span className="badge red" style={{ marginLeft: "auto" }}>{unread[c.id]}</span> : null}
            </button>
          ))}
          <div className="nav-label" style={{ padding: "14px 10px 4px" }}>{canManage ? "Chat privat cu editorii" : "Chat privat cu managerul"}</div>
          {channels.filter((c) => c.kind === "editor" && c.editor_id).map((c) => (
            <button key={c.id} className={`chan-item${activeId === c.id ? " active" : ""}`} onClick={() => setActiveId(c.id)}>
              <span className="status-dot" style={{ background: "var(--accent-2)" }} />
              {canManage ? c.editor?.full_name ?? c.slug : "Managerul tău"}
              {unread[c.id] ? <span className="badge red" style={{ marginLeft: "auto" }}>{unread[c.id]}</span> : null}
            </button>
          ))}
          <div className="nav-label" style={{ padding: "14px 10px 4px" }}>Automate</div>
          {channels.filter((c) => c.kind === "automat").map((c) => (
            <button key={c.id} className={`chan-item${activeId === c.id ? " active" : ""}`} onClick={() => setActiveId(c.id)}>
              {c.label}
              {unread[c.id] ? <span className="badge red" style={{ marginLeft: "auto" }}>{unread[c.id]}</span> : null}
            </button>
          ))}
        </div>

        <div className="chat-main">
          {active ? (
            <>
              <div className="chat-head">
                <div>
                  <div style={{ fontWeight: 700 }}>{active.editor_id && canManage ? `Chat privat — ${active.editor?.full_name ?? active.slug}` : active.editor_id ? "Chat privat cu managerul" : active.label}</div>
                  {active.deadline_note && <div className="faint" style={{ fontSize: 12 }}>{active.deadline_note}</div>}
                </div>
              </div>
              <div className="chat-msgs">
                {activeMessages.map((m) => (
                  <div key={m.id} className="msg">
                    <div className="p-avatar">{m.author ? m.author.initials : "CC"}</div>
                    <div>
                      <div className="p-sub">
                        <b style={{ color: "var(--text-muted)" }}>{m.author ? m.author.full_name : "Creative C Bot"}</b> · {fmtMsgDate(m.created_at, today)}
                      </div>
                      <div className="bubble">
                        {m.body}
                        {m.file_name && (
                          <div className="file-chip">
                            📁 Drive — <span className="mono">{m.file_name}</span>
                            {m.file_url && (
                              <a href={m.file_url} target="_blank" rel="noreferrer" className="btn sm ghost" style={{ marginLeft: "auto", padding: "3px 8px" }}>
                                Descarcă
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {activeMessages.length === 0 && <div className="empty-note">Niciun mesaj încă în acest canal.</div>}
                <div ref={endRef} />
              </div>
              {canPost ? (
                <>
                  {attaching && (
                    <div style={{ padding: "0 18px 10px", display: "flex", gap: 8 }}>
                      <input
                        placeholder="Nume fișier (ex: 27_sept_clip_01-06)"
                        value={fileName}
                        onChange={(e) => setFileName(e.target.value)}
                        style={{ flex: 1, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 9, padding: "8px 10px", fontSize: 12 }}
                      />
                      <input
                        placeholder="Link Drive (opțional)"
                        value={fileUrl}
                        onChange={(e) => setFileUrl(e.target.value)}
                        style={{ flex: 1, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 9, padding: "8px 10px", fontSize: 12 }}
                      />
                    </div>
                  )}
                  <form onSubmit={sendMessage} className="chat-input">
                    <button type="button" className="btn sm ghost" onClick={() => setAttaching((v) => !v)} title="Atașează fișier din Drive">
                      📎
                    </button>
                    <input
                      placeholder="Scrie un mesaj…"
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                    />
                    <button type="submit" className="btn primary sm" disabled={sending || !messageInput.trim()}>
                      {sending ? "…" : "Trimite"}
                    </button>
                  </form>
                </>
              ) : (
                <div className="chat-input">
                  <span className="faint" style={{ fontSize: 12 }}>Doar echipa poate posta în acest canal.</span>
                </div>
              )}
            </>
          ) : (
            <div className="empty-note" style={{ margin: "auto" }}>Niciun canal disponibil.</div>
          )}
        </div>

        {showSide && active?.editor_id && (
          <div className="chat-side">
            <h4>Clipuri de făcut luna aceasta</h4>
            <div className="card" style={{ padding: 12, background: "var(--surface)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="faint" style={{ fontSize: 12 }}>Încărcate</span>
                <span className="mono" style={{ fontWeight: 700 }}>
                  {uploaded} / {activeStock?.clips_total ?? 0}
                </span>
              </div>
              <div className="progress" style={{ marginTop: 8 }}>
                <span style={{ width: activeStock && activeStock.clips_total > 0 ? `${Math.min(100, Math.round((uploaded / activeStock.clips_total) * 100))}%` : "0%", background: "var(--accent-2)" }} />
              </div>
              {canManage && (
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <input
                    type="number"
                    min="0"
                    placeholder="Nr. clipuri"
                    value={stockDraft ?? String(activeStock?.clips_total ?? 0)}
                    onChange={(e) => setStockDraft(e.target.value)}
                    style={{ width: "100%", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 8px", fontSize: 12 }}
                  />
                  <button className="btn sm primary" disabled={stockDraft === null} onClick={saveStock}>Salvează</button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

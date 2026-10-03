"use client";

import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Owner } from "@/components/PipelineBoard";
import { MESSAGE_SELECT } from "@/lib/selects";
import { useRealtimeRows } from "@/lib/useRealtimeRows";
import { EditoriTabContext } from "@/components/EditoriTabs";
import { useNotifications } from "@/components/NotificationsProvider";
import { setActiveChat } from "@/lib/activeChat";
import { ROLE_LABEL, type AppRole } from "@/lib/roles";
import { BUILTIN_STICKERS, builtinSticker, stickerKey } from "@/lib/stickers";
import { BuiltinStickerView } from "@/components/StickerView";

export type ChannelRow = {
  id: string;
  slug: string;
  label: string;
  kind: "editor" | "automat" | "dm";
  editor_id: string | null;
  deadline_note: string | null;
  custom_name: string | null;
  dm_a: string | null;
  dm_b: string | null;
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

export type TeamMember = { id: string; full_name: string; initials: string; role: AppRole };
type StickerRow = { id: string; name: string; path: string; created_by: string };

const CHANNEL_SELECT = "*, editor:profiles!channels_editor_id_fkey(id, full_name, initials)";

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" });
}

function fmtMsgDate(iso: string, today: Date) {
  const d = new Date(iso);
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay ? `azi, ${fmtTime(iso)}` : `${d.toLocaleDateString("ro-RO", { day: "numeric", month: "short" })}, ${fmtTime(iso)}`;
}

export default function ChannelsBoard({
  channels: initialChannels,
  initialMessages,
  team,
  canManage,
  isSuperAdmin,
  currentUserId,
}: {
  channels: ChannelRow[];
  initialMessages: MessageRow[];
  team: TeamMember[];
  canManage: boolean;
  isSuperAdmin: boolean;
  currentUserId: string;
}) {
  const supabase = createClient();
  const [channels, setChannels] = useState(initialChannels);
  const [messages, setMessages] = useState(initialMessages);
  const [messageInput, setMessageInput] = useState("");
  const [attaching, setAttaching] = useState(false);
  const [fileName, setFileName] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [sending, setSending] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [stickerOpen, setStickerOpen] = useState(false);
  const [stickers, setStickers] = useState<StickerRow[]>([]);
  const [stickerBusy, setStickerBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState<string | null>(null); // null = search closed
  const [found, setFound] = useState<{ key: string; rows: MessageRow[] }>({ key: "", rows: [] });
  const [focusId, setFocusId] = useState<string | null>(null);

  const ownChannel = channels.find((c) => c.kind === "editor" && c.editor_id === currentUserId) ?? null;
  const [activeId, setActiveIdState] = useState<string | null>(ownChannel?.id ?? channels.find((c) => c.kind !== "dm")?.id ?? null);
  const { unreadByChannel: unread, markChannelRead } = useNotifications();
  const { tab, chatSeen } = useContext(EditoriTabContext);
  const tabRef = useRef(tab);
  const activeIdRef = useRef(activeId);
  const endRef = useRef<HTMLDivElement>(null);

  function setActiveId(id: string | null) {
    activeIdRef.current = id;
    if (tabRef.current === "chat") setActiveChat(id);
    setActiveIdState(id);
    setRenaming(null);
    setStickerOpen(false);
    setSearch(null);
    if (id) markChannelRead(id);
  }

  // Live: new messages and channel changes (renames, new private chats) appear instantly. RLS decides what this user receives.
  useRealtimeRows<MessageRow>({ table: "channel_messages", select: MESSAGE_SELECT, setRows: setMessages });
  useRealtimeRows<ChannelRow>({ table: "channels", select: CHANNEL_SELECT, setRows: setChannels });

  const [today] = useState(() => new Date());

  // Back on the Canale tab: the open channel counts as read once you have clicked the Canale tab
  // (until then its counter stays, so you notice it).
  useEffect(() => {
    tabRef.current = tab;
    setActiveChat(tab === "chat" ? activeIdRef.current : null);
    if (tab === "chat" && chatSeen && activeIdRef.current) markChannelRead(activeIdRef.current);
  }, [tab, chatSeen, markChannelRead]);
  useEffect(() => () => setActiveChat(null), []);

  // ---- names ----
  const memberName = (id: string | null) => team.find((m) => m.id === id)?.full_name ?? "—";
  function chanName(c: ChannelRow) {
    if (c.kind === "dm") return memberName(c.dm_a === currentUserId ? c.dm_b : c.dm_a);
    const custom = c.custom_name?.trim();
    if (c.kind === "editor" && c.editor_id) {
      if (c.editor_id === currentUserId) return custom || "Chat cu echipa";
      const who = c.editor?.full_name ?? memberName(c.editor_id);
      return custom ? `${custom} · ${who}` : who;
    }
    return custom || c.label;
  }
  const canRename = (c: ChannelRow) =>
    c.kind !== "dm" && (isSuperAdmin || (c.kind === "editor" && c.editor_id === currentUserId) || (c.kind === "editor" && !c.editor_id && canManage));

  async function saveName(c: ChannelRow, value: string) {
    const name = value.trim() || null;
    setRenaming(null);
    if (name === (c.custom_name ?? null)) return;
    setChannels((prev) => prev.map((x) => (x.id === c.id ? { ...x, custom_name: name } : x)));
    const { error } = await supabase.from("channels").update({ custom_name: name }).eq("id", c.id);
    if (error) setNotice(error.message);
  }

  // ---- private chats with any member ----
  const dmWith = (memberId: string) =>
    channels.find((c) => c.kind === "dm" && ((c.dm_a === currentUserId && c.dm_b === memberId) || (c.dm_a === memberId && c.dm_b === currentUserId))) ?? null;

  async function openDm(memberId: string) {
    setNotice(null);
    const existing = dmWith(memberId);
    if (existing) return setActiveId(existing.id);
    const { data: id, error } = await supabase.rpc("open_dm", { p_other: memberId });
    if (error || !id) return setNotice(error?.message ?? "Nu am putut deschide chatul.");
    const { data: row } = await supabase.from("channels").select(CHANNEL_SELECT).eq("id", id as string).single();
    if (row) setChannels((prev) => (prev.some((c) => c.id === row.id) ? prev : [...prev, row as unknown as ChannelRow]));
    setActiveId(id as string);
  }

  const members = useMemo(
    () =>
      team
        .filter((m) => m.id !== currentUserId)
        .map((m) => ({ ...m, dm: dmWith(m.id) }))
        .sort((a, b) => (unread[b.dm?.id ?? ""] ?? 0) - (unread[a.dm?.id ?? ""] ?? 0) || a.full_name.localeCompare(b.full_name)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [team, channels, unread, currentUserId],
  );

  const active = channels.find((c) => c.id === activeId) ?? null;
  const activeMessages = useMemo(
    () => messages.filter((m) => m.channel_id === activeId).sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [messages, activeId],
  );

  const isGroup = !!active && active.kind === "editor" && !active.editor_id;
  useEffect(() => {
    if (focusId) {
      document.getElementById(`msg-${focusId}`)?.scrollIntoView({ block: "center" });
      const t = setTimeout(() => setFocusId(null), 3500);
      return () => clearTimeout(t);
    }
    endRef.current?.scrollIntoView({ block: "end" });
  }, [activeMessages.length, activeId, focusId]);

  // ---- search inside the open chat (all of its history, not just what is loaded) ----
  useEffect(() => {
    const term = search?.trim() ?? "";
    if (!activeId || term.length < 2) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc("search_messages", { p_channel: activeId, p_q: term });
      if (cancelled) return;
      setFound({
        key: `${activeId}|${term}`,
        rows: (data ?? []).map((m) => ({ ...m, author: team.find((x) => x.id === m.author_id) ?? null })) as unknown as MessageRow[],
      });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, activeId]);

  const searchTerm = search?.trim() ?? "";
  const searching = searchTerm.length >= 2 && found.key !== `${activeId}|${searchTerm}`;
  const results = searching ? [] : found.rows;

  // Open the conversation around an old message: load 25 messages before and after it, then scroll to it.
  async function jumpTo(m: MessageRow) {
    const [before, after] = await Promise.all([
      supabase.from("channel_messages").select(MESSAGE_SELECT).eq("channel_id", m.channel_id).lte("created_at", m.created_at).order("created_at", { ascending: false }).limit(25),
      supabase.from("channel_messages").select(MESSAGE_SELECT).eq("channel_id", m.channel_id).gt("created_at", m.created_at).order("created_at", { ascending: true }).limit(25),
    ]);
    const extra = [...((before.data ?? []) as unknown as MessageRow[]), ...((after.data ?? []) as unknown as MessageRow[])];
    setMessages((prev) => {
      const known = new Set(prev.map((x) => x.id));
      return [...prev, ...extra.filter((x) => !known.has(x.id))];
    });
    setSearch(null);
    setFocusId(m.id);
  }

  const highlight = (text: string) => {
    const term = search?.trim() ?? "";
    if (term.length < 2) return text;
    const i = text.toLowerCase().indexOf(term.toLowerCase());
    if (i < 0) return text;
    return (
      <>
        {text.slice(0, i)}
        <mark style={{ background: "#ffd54a", color: "#111", borderRadius: 3, padding: "0 2px" }}>{text.slice(i, i + term.length)}</mark>
        {text.slice(i + term.length)}
      </>
    );
  };

  const canPost =
    !!active && (active.kind === "dm" || (active.kind === "automat" ? canManage : canManage || active.editor_id === currentUserId || isGroup));

  // ---- stickers ----
  const loadStickers = () =>
    supabase.from("stickers").select("*").order("created_at", { ascending: false }).then(({ data }) => setStickers((data ?? []) as StickerRow[]));
  useEffect(() => {
    loadStickers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const stickerUrl = (s: StickerRow) => supabase.storage.from("stickers").getPublicUrl(s.path).data.publicUrl;
  // a sticker somebody else added after this page loaded: fetch the list again
  useEffect(() => {
    const missing = activeMessages.some((m) => {
      const k = stickerKey(m.body);
      return k?.startsWith("custom:") && !stickers.some((s) => s.id === k.slice(7));
    });
    if (missing) loadStickers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMessages.length]);

  async function addSticker(file: File) {
    setNotice(null);
    if (file.size > 1_048_576) return setNotice("Stickerul poate avea maxim 1 MB.");
    setStickerBusy(true);
    const safe = file.name.replace(/[^\w.\-]+/g, "_");
    const path = `${currentUserId}/${Date.now()}-${safe}`;
    const { error: upErr } = await supabase.storage.from("stickers").upload(path, file);
    if (upErr) {
      setStickerBusy(false);
      return setNotice(upErr.message);
    }
    const { error } = await supabase.from("stickers").insert({ name: file.name.replace(/\.[^.]+$/, "").slice(0, 30), path });
    setStickerBusy(false);
    if (error) return setNotice(error.message);
    loadStickers();
  }

  async function removeSticker(s: StickerRow) {
    if (!window.confirm("Ștergi stickerul?")) return;
    await supabase.storage.from("stickers").remove([s.path]);
    await supabase.from("stickers").delete().eq("id", s.id);
    setStickers((prev) => prev.filter((x) => x.id !== s.id));
  }

  async function post(body: string, extra?: { file_name: string | null; file_url: string | null }) {
    if (!active) return false;
    setSending(true);
    const { data, error } = await supabase
      .from("channel_messages")
      .insert({ channel_id: active.id, author_id: currentUserId, body, file_name: extra?.file_name ?? null, file_url: extra?.file_url ?? null })
      .select(MESSAGE_SELECT)
      .single();
    setSending(false);
    if (error) {
      setNotice(error.message);
      return false;
    }
    setMessages((prev) => (prev.some((m) => m.id === (data as MessageRow).id) ? prev : [...prev, data as MessageRow]));
    return true;
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!messageInput.trim()) return;
    const ok = await post(messageInput.trim(), { file_name: fileName.trim() || null, file_url: fileUrl.trim() || null });
    if (!ok) return;
    setMessageInput("");
    setFileName("");
    setFileUrl("");
    setAttaching(false);
  }

  async function sendSticker(ref: string) {
    setStickerOpen(false);
    await post(`::sticker::${ref}`);
  }

  function renderBody(m: MessageRow) {
    const k = stickerKey(m.body);
    if (k) {
      if (k.startsWith("builtin:")) {
        const s = builtinSticker(k.slice(8));
        return s ? <BuiltinStickerView s={s} /> : <span className="faint">[sticker]</span>;
      }
      const cs = stickers.find((x) => x.id === k.slice(7));
      // eslint-disable-next-line @next/next/no-img-element
      return cs ? <img src={stickerUrl(cs)} alt={cs.name || "sticker"} style={{ maxWidth: 170, maxHeight: 170, borderRadius: 12 }} /> : <span className="faint">[sticker]</span>;
    }
    return null;
  }

  const groupChannels = channels.filter((c) => c.kind === "editor" && !c.editor_id);
  const privateChannels = channels.filter((c) => c.kind === "editor" && c.editor_id);
  const autoChannels = channels.filter((c) => c.kind === "automat");

  const unreadBadge = (id: string) => (unread[id] ? <span className="badge red" style={{ marginLeft: "auto" }}>{unread[id]}</span> : null);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Canale</h1>
          <p>Chat de grup cu toți editorii, chat cu managerul și mesaje private între toți membrii.</p>
        </div>
      </div>
      {notice && <div className="field-error" style={{ marginBottom: 10 }}>{notice}</div>}

      <div className="chat-shell chat-fixed">
        <div className="chan-list">
          <div className="nav-label" style={{ padding: "4px 10px" }}>General</div>
          {groupChannels.map((c) => (
            <button key={c.id} className={`chan-item${activeId === c.id ? " active" : ""}`} onClick={() => setActiveId(c.id)}>
              {chanName(c)}
              {unreadBadge(c.id)}
            </button>
          ))}
          <div className="nav-label" style={{ padding: "14px 10px 4px" }}>{canManage ? "Chat cu editorii" : "Chat cu managerul"}</div>
          {privateChannels.map((c) => (
            <button key={c.id} className={`chan-item${activeId === c.id ? " active" : ""}`} onClick={() => setActiveId(c.id)}>
              <span className="status-dot" style={{ background: "var(--accent-2)" }} />
              {chanName(c)}
              {unreadBadge(c.id)}
            </button>
          ))}
          <div className="nav-label" style={{ padding: "14px 10px 4px" }}>Automate</div>
          {autoChannels.map((c) => (
            <button key={c.id} className={`chan-item${activeId === c.id ? " active" : ""}`} onClick={() => setActiveId(c.id)}>
              {chanName(c)}
              {unreadBadge(c.id)}
            </button>
          ))}
        </div>

        <div className="chat-main">
          {active ? (
            <>
              <div className="chat-head">
                <div style={{ flex: 1, minWidth: 0 }}>
                  {renaming === active.id ? (
                    <input
                      autoFocus
                      defaultValue={active.custom_name ?? ""}
                      maxLength={40}
                      placeholder={active.kind === "editor" && active.editor_id === currentUserId ? "Chat cu echipa" : active.label}
                      onBlur={(e) => saveName(active, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.currentTarget.blur();
                        if (e.key === "Escape") setRenaming(null);
                      }}
                      style={{ fontWeight: 700, width: "100%", maxWidth: 320 }}
                    />
                  ) : (
                    <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                      {active.kind === "dm" ? `Mesaj direct — ${chanName(active)}` : chanName(active)}
                      {canRename(active) && (
                        <button type="button" className="icon-btn" style={{ width: 24, height: 24 }} title="Schimbă numele chatului" onClick={() => setRenaming(active.id)}>✎</button>
                      )}
                    </div>
                  )}
                  {active.deadline_note && <div className="faint" style={{ fontSize: 12 }}>{active.deadline_note}</div>}
                </div>
                {search === null ? (
                  <button type="button" className="icon-btn" title="Caută în acest chat" aria-label="Caută în acest chat" onClick={() => setSearch("")}>🔍</button>
                ) : (
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input
                      autoFocus
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      onKeyDown={(e) => e.key === "Escape" && setSearch(null)}
                      placeholder="Caută un cuvânt…"
                      style={{ width: 220 }}
                    />
                    <button type="button" className="icon-btn" title="Închide căutarea" onClick={() => setSearch(null)}>✕</button>
                  </div>
                )}
              </div>
              {search !== null && search.trim().length >= 2 ? (
              <div className="chat-msgs">
                <div className="faint" style={{ fontSize: 12, marginBottom: 6 }}>
                  {searching ? "Se caută…" : results.length === 0 ? "Niciun mesaj găsit." : `${results.length}${results.length === 100 ? "+" : ""} mesaje găsite, cele mai noi primele. Apasă pe unul ca să-l vezi în conversație.`}
                </div>
                {results.map((m) => (
                  <button key={m.id} type="button" className="msg" onClick={() => jumpTo(m)} style={{ background: "none", border: "none", textAlign: "left", cursor: "pointer", padding: 0, color: "inherit" }}>
                    <div className="p-avatar">{m.author ? m.author.initials : "CC"}</div>
                    <div>
                      <div className="p-sub">
                        <b style={{ color: "var(--text-muted)" }}>{m.author ? m.author.full_name : "CS Studio Bot"}</b> · {new Date(m.created_at).toLocaleString("ro-RO", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </div>
                      <div className="bubble">{highlight(m.body)}{m.file_name ? <div className="faint" style={{ fontSize: 11.5, marginTop: 4 }}>📁 {highlight(m.file_name)}</div> : null}</div>
                    </div>
                  </button>
                ))}
              </div>
              ) : (
              <div className="chat-msgs">
                {activeMessages.map((m) => {
                  const sticker = renderBody(m);
                  return (
                    <div key={m.id} id={`msg-${m.id}`} className="msg" style={focusId === m.id ? { outline: "2px solid #ffd54a", outlineOffset: 4, borderRadius: 10 } : undefined}>
                      <div className="p-avatar">{m.author ? m.author.initials : "CC"}</div>
                      <div>
                        <div className="p-sub">
                          <b style={{ color: "var(--text-muted)" }}>{m.author ? m.author.full_name : "CS Studio Bot"}</b> · {fmtMsgDate(m.created_at, today)}
                        </div>
                        {sticker ? (
                          <div style={{ marginTop: 4 }}>{sticker}</div>
                        ) : (
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
                        )}
                      </div>
                    </div>
                  );
                })}
                {activeMessages.length === 0 && <div className="empty-note">Niciun mesaj încă în acest chat.</div>}
                <div ref={endRef} />
              </div>
              )}
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
                  {stickerOpen && (
                    <div className="card" style={{ margin: "0 18px 10px", padding: 12, maxHeight: 280, overflowY: "auto" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 10 }}>
                        {BUILTIN_STICKERS.map((s) => (
                          <button key={s.key} type="button" onClick={() => sendSticker(`builtin:${s.key}`)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}>
                            <BuiltinStickerView s={s} size={96} />
                          </button>
                        ))}
                        {stickers.map((s) => (
                          <div key={s.id} style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--surface-2)", borderRadius: 12, height: 96 }}>
                            <button type="button" onClick={() => sendSticker(`custom:${s.id}`)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={stickerUrl(s)} alt={s.name || "sticker"} style={{ maxWidth: 88, maxHeight: 88, borderRadius: 8 }} />
                            </button>
                            {(s.created_by === currentUserId || isSuperAdmin) && (
                              <button type="button" className="icon-btn" title="Șterge stickerul" style={{ position: "absolute", top: 2, right: 2, width: 20, height: 20, fontSize: 10 }} onClick={() => removeSticker(s)}>✕</button>
                            )}
                          </div>
                        ))}
                        <label
                          style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, height: 96, borderRadius: 12, border: "2px dashed var(--border)", cursor: stickerBusy ? "wait" : "pointer", fontSize: 11, color: "var(--text-muted)", textAlign: "center" }}
                        >
                          <span style={{ fontSize: 22 }}>＋</span>
                          {stickerBusy ? "Se încarcă…" : "Adaugă sticker"}
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/gif"
                            hidden
                            disabled={stickerBusy}
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              e.target.value = "";
                              if (f) addSticker(f);
                            }}
                          />
                        </label>
                      </div>
                      <div className="faint" style={{ fontSize: 11, marginTop: 8 }}>Imagine PNG, JPG, WEBP sau GIF, maxim 1 MB. Stickerele adăugate de tine le văd toți.</div>
                    </div>
                  )}
                  <form onSubmit={sendMessage} className="chat-input">
                    <button type="button" className="btn sm ghost" onClick={() => setAttaching((v) => !v)} title="Atașează fișier din Drive">
                      📎
                    </button>
                    <button type="button" className="btn sm ghost" onClick={() => setStickerOpen((v) => !v)} title="Stickere">
                      😜
                    </button>
                    <input placeholder="Scrie un mesaj…" value={messageInput} onChange={(e) => setMessageInput(e.target.value)} />
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

        <div className="chat-side">
          <h4>Mesaje private</h4>
          <div style={{ display: "grid", gap: 2 }}>
            {members.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`chan-item${m.dm && activeId === m.dm.id ? " active" : ""}`}
                onClick={() => openDm(m.id)}
                title={`Scrie-i lui ${m.full_name}`}
              >
                <span className="p-avatar" style={{ width: 24, height: 24, fontSize: 10 }}>{m.initials}</span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.full_name}</span>
                  <span className="faint" style={{ fontSize: 10.5 }}>{ROLE_LABEL[m.role] ?? m.role}</span>
                </span>
                {m.dm && unreadBadge(m.dm.id)}
              </button>
            ))}
            {members.length === 0 && <div className="empty-note">Nu mai e nimeni în echipă.</div>}
          </div>
        </div>
      </div>
    </>
  );
}

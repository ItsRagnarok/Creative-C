"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Owner } from "@/components/PipelineBoard";

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

export type DailyStatusRow = {
  id: string;
  editor_id: string;
  status_date: string;
  status: "video_complet" | "in_revizuire" | "neactualizat";
  editor: Owner | null;
};

export type ClipStockRow = {
  editor_id: string;
  clips_remaining: number;
  clips_total: number;
};

const STATUS_LABEL: Record<DailyStatusRow["status"], string> = {
  video_complet: "Video complet",
  in_revizuire: "În revizuire",
  neactualizat: "Neactualizat",
};
const STATUS_BADGE: Record<DailyStatusRow["status"], string> = {
  video_complet: "green",
  in_revizuire: "blue",
  neactualizat: "gray",
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
  initialStatuses,
  initialStock,
  canManage,
  currentUserId,
}: {
  channels: ChannelRow[];
  initialMessages: MessageRow[];
  initialStatuses: DailyStatusRow[];
  initialStock: ClipStockRow[];
  canManage: boolean;
  currentUserId: string;
}) {
  const supabase = createClient();
  const [messages, setMessages] = useState(initialMessages);
  const [statuses, setStatuses] = useState(initialStatuses);
  const [stock, setStock] = useState(initialStock);
  const [messageInput, setMessageInput] = useState("");
  const [attaching, setAttaching] = useState(false);
  const [fileName, setFileName] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [sending, setSending] = useState(false);
  const [stockDraft, setStockDraft] = useState<{ remaining: string; total: string } | null>(null);

  const ownChannel = channels.find((c) => c.editor_id === currentUserId) ?? null;
  const [activeId, setActiveId] = useState<string | null>(ownChannel?.id ?? channels[0]?.id ?? null);

  const [today] = useState(() => new Date());

  const active = channels.find((c) => c.id === activeId) ?? null;
  const activeMessages = useMemo(
    () => messages.filter((m) => m.channel_id === activeId).sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [messages, activeId],
  );

  const canPost = !!active && (canManage || active.editor_id === currentUserId);

  const activeStock = active?.editor_id ? stock.find((s) => s.editor_id === active.editor_id) ?? null : null;
  const activeStatus = active?.editor_id ? statuses.find((s) => s.editor_id === active.editor_id) ?? null : null;

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
      .select("*, author:profiles(id, full_name, initials)")
      .single();
    setSending(false);
    if (error) return;
    setMessages((prev) => [...prev, data as MessageRow]);
    setMessageInput("");
    setFileName("");
    setFileUrl("");
    setAttaching(false);
  }

  async function bifaStatus(editorId: string, status: DailyStatusRow["status"]) {
    const statusDate = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from("editor_daily_status")
      .upsert({ editor_id: editorId, status_date: statusDate, status }, { onConflict: "editor_id,status_date" })
      .select("*, editor:profiles(id, full_name, initials)")
      .single();
    if (error) return;
    setStatuses((prev) => {
      const existing = prev.find((s) => s.editor_id === editorId && s.status_date === statusDate);
      if (existing) return prev.map((s) => (s.id === existing.id ? (data as DailyStatusRow) : s));
      return [...prev, data as DailyStatusRow];
    });
  }

  function openStockEdit() {
    setStockDraft({
      remaining: String(activeStock?.clips_remaining ?? 0),
      total: String(activeStock?.clips_total ?? 40),
    });
  }

  async function saveStock() {
    if (!active?.editor_id || !stockDraft) return;
    const remaining = Number(stockDraft.remaining) || 0;
    const total = Number(stockDraft.total) || 0;
    const { data, error } = await supabase
      .from("editor_clip_stock")
      .upsert({ editor_id: active.editor_id, clips_remaining: remaining, clips_total: total })
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

  const showSide = !!active && active.kind === "editor";

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Canale editori</h1>
          <p>Fiecare editor are propriul canal — își pune acolo clipurile (Drive + dată + nr. clip), tu descarci direct de acolo.</p>
        </div>
      </div>

      <div className={`chat-shell${showSide ? "" : " no-side"}`}>
        <div className="chan-list">
          <div className="nav-label" style={{ padding: "4px 10px" }}>Canale editori</div>
          {channels.filter((c) => c.kind === "editor").map((c) => (
            <button key={c.id} className={`chan-item${activeId === c.id ? " active" : ""}`} onClick={() => setActiveId(c.id)}>
              <span className="status-dot" style={{ background: "var(--accent-2)" }} />
              {c.slug}
            </button>
          ))}
          <div className="nav-label" style={{ padding: "14px 10px 4px" }}>Automate</div>
          {channels.filter((c) => c.kind === "automat").map((c) => (
            <button key={c.id} className={`chan-item${activeId === c.id ? " active" : ""}`} onClick={() => setActiveId(c.id)}>
              {c.label}
            </button>
          ))}
        </div>

        <div className="chat-main">
          {active ? (
            <>
              <div className="chat-head">
                <div>
                  <div style={{ fontWeight: 700 }}>#{active.slug}</div>
                  {active.deadline_note && <div className="faint" style={{ fontSize: 12 }}>{active.deadline_note}</div>}
                </div>
                {activeStatus && (
                  <span className={`badge ${STATUS_BADGE[activeStatus.status]}`}>● {STATUS_LABEL[activeStatus.status]} — azi</span>
                )}
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
                      placeholder={`Scrie un mesaj în #${active.slug}…`}
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
            {canManage && (
              <>
                <h4>Status zilnic — bifat de manager</h4>
                <div className="list">
                  {statuses.map((s) => (
                    <div key={s.id} className="list-row">
                      <div style={{ flex: 1 }}>
                        <div className="p-name" style={{ fontSize: 12.5 }}>{s.editor?.full_name ?? "—"}</div>
                        <div className="faint" style={{ fontSize: 11 }}>azi</div>
                      </div>
                      <span className={`badge ${STATUS_BADGE[s.status]}`}>{STATUS_LABEL[s.status]}</span>
                    </div>
                  ))}
                  {statuses.length === 0 && <div className="empty-note">Niciun status azi.</div>}
                </div>

                <h4 style={{ marginTop: 22 }}>Bifează pentru {active.editor?.full_name}</h4>
                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                  <button
                    className="btn sm"
                    style={{ flex: 1, background: "var(--accent-2-soft)", color: "var(--accent-2)", borderColor: "transparent" }}
                    onClick={() => bifaStatus(active.editor_id!, "video_complet")}
                  >
                    ✓ Video complet
                  </button>
                  <button className="btn sm ghost" style={{ flex: 1 }} onClick={() => bifaStatus(active.editor_id!, "in_revizuire")}>
                    ◔ În revizuire
                  </button>
                </div>
              </>
            )}

            {!canManage && activeStatus && (
              <>
                <h4>Statusul tău azi</h4>
                <span className={`badge ${STATUS_BADGE[activeStatus.status]}`}>{STATUS_LABEL[activeStatus.status]}</span>
              </>
            )}

            <h4 style={{ marginTop: canManage ? 0 : 22 }}>Stoc clipuri lună curentă</h4>
            <div className="card" style={{ padding: 12, background: "var(--surface)" }}>
              {stockDraft ? (
                <>
                  <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                    <input
                      type="number"
                      min="0"
                      value={stockDraft.remaining}
                      onChange={(e) => setStockDraft({ ...stockDraft, remaining: e.target.value })}
                      style={{ width: "50%", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 8px", fontSize: 12 }}
                    />
                    <input
                      type="number"
                      min="0"
                      value={stockDraft.total}
                      onChange={(e) => setStockDraft({ ...stockDraft, total: e.target.value })}
                      style={{ width: "50%", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 8px", fontSize: 12 }}
                    />
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn sm ghost" style={{ flex: 1 }} onClick={() => setStockDraft(null)}>Renunță</button>
                    <button className="btn sm primary" style={{ flex: 1 }} onClick={saveStock}>Salvează</button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span className="faint" style={{ fontSize: 12 }}>Rămase din pachet</span>
                    <span className="mono" style={{ fontWeight: 700, color: "var(--warning)" }}>
                      {activeStock ? `${activeStock.clips_remaining} / ${activeStock.clips_total}` : "—"}
                    </span>
                  </div>
                  <div className="progress" style={{ marginTop: 8 }}>
                    <span style={{ width: activeStock && activeStock.clips_total > 0 ? `${Math.round((activeStock.clips_remaining / activeStock.clips_total) * 100)}%` : "0%", background: "var(--warning)" }} />
                  </div>
                  <div className="faint" style={{ fontSize: 11, marginTop: 8 }}>
                    Sub 10 → alertă automată către manager pentru a programa filmarea următoare.
                  </div>
                  {canManage && (
                    <button className="btn sm ghost" style={{ width: "100%", justifyContent: "center", marginTop: 10 }} onClick={openStockEdit}>
                      Editează stocul
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

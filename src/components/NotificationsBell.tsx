"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getActiveChat } from "@/lib/activeChat";
import { playMessageSound } from "@/lib/notifySound";

export type NotificationRow = {
  id: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
  channel_id?: string | null;
};

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "acum";
  if (mins < 60) return `acum ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `acum ${hours} h`;
  const days = Math.round(hours / 24);
  return `acum ${days} zile`;
}

export default function NotificationsBell({ initial }: { initial: NotificationRow[] }) {
  const [items, setItems] = useState(initial);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  const unread = items.filter((n) => !n.is_read).length;
  const [toast, setToast] = useState<NotificationRow | null>(null);

  // Live: a new notification shows up (and pops a toast) without a refresh.
  useEffect(() => {
    const ch = supabase
      .channel("notifications-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, (payload) => {
        const n = payload.new as NotificationRow;
        // A message in the chat you have open is already in front of you: file it as read, no toast.
        if (n.channel_id && n.channel_id === getActiveChat()) {
          setItems((prev) => (prev.some((x) => x.id === n.id) ? prev : [{ ...n, is_read: true }, ...prev]));
          supabase.from("notifications").update({ is_read: true }).eq("id", n.id).then(() => {});
          return;
        }
        setItems((prev) => (prev.some((x) => x.id === n.id) ? prev : [n, ...prev]));
        setToast(n);
        if (n.channel_id) playMessageSound();
        setTimeout(() => setToast((t) => (t && t.id === n.id ? null : t)), 6000);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function markRead(id: string) {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
  }

  async function markAllRead() {
    const unreadIds = items.filter((n) => !n.is_read).map((n) => n.id);
    if (!unreadIds.length) return;
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    await supabase.from("notifications").update({ is_read: true }).in("id", unreadIds);
  }

  return (
    <div style={{ position: "relative" }} ref={ref}>
      <button className="icon-btn" onClick={() => setOpen((v) => !v)} aria-label="Notificări">
        🔔
        {unread > 0 && <span className="dot" />}
      </button>
      {toast && !open && (
        <div
          className="card"
          style={{ position: "fixed", right: 20, bottom: 20, zIndex: 80, maxWidth: 320, boxShadow: "var(--shadow)", cursor: "pointer" }}
          onClick={() => { setOpen(true); setToast(null); }}
        >
          <div style={{ fontWeight: 700, fontSize: 13 }}>{toast.title}</div>
          <div className="faint" style={{ fontSize: 12.5, marginTop: 4 }}>{toast.body}</div>
        </div>
      )}
      {open && (
        <div className="dropdown-panel">
          <div className="head">
            <span>Notificări {unread > 0 && `(${unread} noi)`}</span>
            {unread > 0 && (
              <button className="btn sm ghost" onClick={markAllRead}>
                Marchează tot citit
              </button>
            )}
          </div>
          {items.length === 0 && <div className="dropdown-empty">Nicio notificare încă.</div>}
          {items.map((n) => (
            <div
              key={n.id}
              className={`n-item ${!n.is_read ? "unread" : ""}`}
              onClick={() => markRead(n.id)}
            >
              <div className="t">{n.title}</div>
              <div className="b">{n.body}</div>
              <div className="ts">{timeAgo(n.created_at)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

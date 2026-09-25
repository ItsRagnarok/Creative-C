"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type NotificationRow = {
  id: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
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

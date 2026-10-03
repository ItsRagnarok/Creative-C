"use client";

import { useEffect, useRef, useState } from "react";
import { useNotifications, type NotificationRow } from "@/components/NotificationsProvider";

export type { NotificationRow };

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

export default function NotificationsBell() {
  const { items, unread, toast, dismissToast, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

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
          onClick={() => { setOpen(true); dismissToast(); }}
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

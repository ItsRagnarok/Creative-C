"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
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

type Ctx = {
  items: NotificationRow[];
  unread: number;
  chatUnread: number; // unread chat messages, all channels
  unreadByChannel: Record<string, number>;
  toast: NotificationRow | null;
  dismissToast: () => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  markChannelRead: (channelId: string) => void;
};

const NotificationsContext = createContext<Ctx>({
  items: [],
  unread: 0,
  chatUnread: 0,
  unreadByChannel: {},
  toast: null,
  dismissToast: () => {},
  markRead: () => {},
  markAllRead: () => {},
  markChannelRead: () => {},
});

export const useNotifications = () => useContext(NotificationsContext);

// One source of truth for notifications: the bell, the sidebar, the Canale tabs and each channel's counter all read from here,
// so a message shows up everywhere at once and clears everywhere once it has been read.
export default function NotificationsProvider({ initial, children }: { initial: NotificationRow[]; children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState(initial);
  const [toast, setToast] = useState<NotificationRow | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const ch = supabase
      .channel("notifications-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, (payload) => {
        const n = payload.new as NotificationRow;
        // A message in the chat you are looking at is filed as read straight away: no counter, no toast, no sound.
        if (n.channel_id && n.channel_id === getActiveChat()) {
          setItems((prev) => (prev.some((x) => x.id === n.id) ? prev : [{ ...n, is_read: true }, ...prev]));
          supabase.from("notifications").update({ is_read: true }).eq("id", n.id).then(() => {});
          return;
        }
        setItems((prev) => (prev.some((x) => x.id === n.id) ? prev : [n, ...prev]));
        setToast(n);
        if (n.channel_id) playMessageSound();
        if (toastTimer.current) clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToast((t) => (t && t.id === n.id ? null : t)), 6000);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [supabase]);

  const markRead = useCallback(
    (id: string) => {
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
      supabase.from("notifications").update({ is_read: true }).eq("id", id).then(() => {});
    },
    [supabase],
  );

  const markAllRead = useCallback(() => {
    setItems((prev) => {
      const ids = prev.filter((n) => !n.is_read).map((n) => n.id);
      if (ids.length) supabase.from("notifications").update({ is_read: true }).in("id", ids).then(() => {});
      return prev.map((n) => ({ ...n, is_read: true }));
    });
  }, [supabase]);

  const markChannelRead = useCallback(
    (channelId: string) => {
      setItems((prev) => {
        const ids = prev.filter((n) => n.channel_id === channelId && !n.is_read).map((n) => n.id);
        if (ids.length === 0) return prev;
        supabase.from("notifications").update({ is_read: true }).in("id", ids).then(() => {});
        return prev.map((n) => (n.channel_id === channelId ? { ...n, is_read: true } : n));
      });
    },
    [supabase],
  );

  const value = useMemo<Ctx>(() => {
    const unreadByChannel: Record<string, number> = {};
    let chatUnread = 0;
    for (const n of items) {
      if (!n.is_read && n.channel_id) {
        unreadByChannel[n.channel_id] = (unreadByChannel[n.channel_id] ?? 0) + 1;
        chatUnread++;
      }
    }
    return {
      items,
      unread: items.filter((n) => !n.is_read).length,
      chatUnread,
      unreadByChannel,
      toast,
      dismissToast: () => setToast(null),
      markRead,
      markAllRead,
      markChannelRead,
    };
  }, [items, toast, markRead, markAllRead, markChannelRead]);

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

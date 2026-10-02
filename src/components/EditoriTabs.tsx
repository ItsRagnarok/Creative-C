"use client";

import { createContext, useState } from "react";

// Lets the chat (always mounted) tell the tab bar which tab is open and how many messages are unread.
export const EditoriTabContext = createContext<{ tab: string; setChatUnread: (n: number) => void }>({
  tab: "chat",
  setChatUnread: () => {},
});

// Chat channels and the content calendar share one page so the sidebar
// doesn't grow; both stay mounted so switching tabs never loses state.
export default function EditoriTabs({
  chat,
  calendar,
  cards,
  defaultTab = "chat",
}: {
  chat: React.ReactNode;
  calendar: React.ReactNode;
  cards: React.ReactNode;
  defaultTab?: "chat" | "calendar" | "cards";
}) {
  const [tab, setTab] = useState<"chat" | "calendar" | "cards">(defaultTab);
  const [chatUnread, setChatUnread] = useState(0);
  const blink = chatUnread > 0 && tab !== "chat";

  return (
    <EditoriTabContext.Provider value={{ tab, setChatUnread }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        <button type="button" className={`btn sm ${tab === "chat" ? "primary" : "ghost"}${blink ? " tab-blink" : ""}`} onClick={() => setTab("chat")}>
          Canale{blink && <span className="badge red" style={{ marginLeft: 8, padding: "1px 7px" }}>{chatUnread}</span>}
        </button>
        <button type="button" className={`btn sm ${tab === "calendar" ? "primary" : "ghost"}`} onClick={() => setTab("calendar")}>
          Calendar content
        </button>
        <button type="button" className={`btn sm ${tab === "cards" ? "primary" : "ghost"}`} onClick={() => setTab("cards")}>
          Cartonașe
        </button>
      </div>
      <div style={{ display: tab === "chat" ? "block" : "none" }}>{chat}</div>
      <div style={{ display: tab === "calendar" ? "block" : "none" }}>{calendar}</div>
      <div style={{ display: tab === "cards" ? "block" : "none" }}>{cards}</div>
    </EditoriTabContext.Provider>
  );
}

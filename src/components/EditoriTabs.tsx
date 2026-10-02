"use client";

import { useState } from "react";

// Chat channels and the content calendar share one page so the sidebar
// doesn't grow; both stay mounted so switching tabs never loses state.
export default function EditoriTabs({
  chat,
  calendar,
  defaultTab = "chat",
}: {
  chat: React.ReactNode;
  calendar: React.ReactNode;
  defaultTab?: "chat" | "calendar";
}) {
  const [tab, setTab] = useState<"chat" | "calendar">(defaultTab);

  return (
    <>
      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        <button type="button" className={`btn sm ${tab === "chat" ? "primary" : "ghost"}`} onClick={() => setTab("chat")}>
          Canale
        </button>
        <button type="button" className={`btn sm ${tab === "calendar" ? "primary" : "ghost"}`} onClick={() => setTab("calendar")}>
          Calendar content
        </button>
      </div>
      <div style={{ display: tab === "chat" ? "block" : "none" }}>{chat}</div>
      <div style={{ display: tab === "calendar" ? "block" : "none" }}>{calendar}</div>
    </>
  );
}

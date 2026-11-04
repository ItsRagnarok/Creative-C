"use client";

import { Analytics } from "@vercel/analytics/next";

export function WebAnalytics() {
  return (
    <Analytics
      beforeSend={(event) => {
        const url = new URL(event.url, window.location.origin);
        url.search = "";
        url.hash = "";
        url.pathname = url.pathname.replace(/^\/clienti\/[^/]+\/?$/, "/clienti/[id]");
        return { ...event, url: url.toString() };
      }}
    />
  );
}

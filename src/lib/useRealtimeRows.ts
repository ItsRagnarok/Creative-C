"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

type Row = { id: string };
type RealtimeTable = "leads" | "bookings" | "projects" | "project_tasks" | "project_files" | "channel_messages" | "prospects";

// Keeps a list of rows live: inserts, updates and deletes made by anyone appear without a refresh.
// Row-level security decides what this user receives; the changed row is re-read with the page's own
// select string so joined data (owner, link…) has the same shape as the initial load.
export function useRealtimeRows<T extends Row>({
  table,
  select,
  setRows,
  position = "end",
  onChange,
}: {
  table: RealtimeTable;
  select: string;
  setRows: React.Dispatch<React.SetStateAction<T[]>>;
  position?: "start" | "end";
  onChange?: (row: T, event: "INSERT" | "UPDATE") => void;
}) {
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`live-${table}`)
      .on("postgres_changes", { event: "*", schema: "public", table }, async (payload) => {
        if (payload.eventType === "DELETE") {
          const id = (payload.old as Row).id;
          if (id) setRows((prev) => prev.filter((r) => r.id !== id));
          return;
        }
        const id = (payload.new as Row).id;
        const { data } = await supabase.from(table).select(select).eq("id", id).maybeSingle();
        if (!data) return;
        const row = data as unknown as T;
        setRows((prev) =>
          prev.some((r) => r.id === row.id)
            ? prev.map((r) => (r.id === row.id ? row : r))
            : position === "start"
              ? [row, ...prev]
              : [...prev, row],
        );
        onChangeRef.current?.(row, payload.eventType);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, select, setRows, position]);
}

// For views that load a filtered slice (one editor's month, one editor's cards): on any change to the table,
// re-run the page's own loader. RLS still decides what this user is told about.
export function useRealtimeRefetch(table: "content_calendar" | "editor_cards", refetch: () => void) {
  const ref = useRef(refetch);
  useEffect(() => {
    ref.current = refetch;
  });
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`live-refetch-${table}`)
      .on("postgres_changes", { event: "*", schema: "public", table }, () => ref.current())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [table]);
}

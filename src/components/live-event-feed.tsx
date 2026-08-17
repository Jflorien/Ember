"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type FeedRow = {
  id: string;
  seq: number;
  type: string;
  payload: { text?: string };
  committed_at: string;
};

function narrationText(row: FeedRow) {
  return typeof row.payload?.text === "string" ? row.payload.text : `[${row.type}]`;
}

/**
 * Read-only, live view of a session's committed events. This is the "table
 * view" half of "one event end-to-end" — it never proposes anything, only
 * subscribes and renders what the DM console already committed.
 */
export function LiveEventFeed({ sessionId }: { sessionId: string }) {
  const [events, setEvents] = useState<FeedRow[]>([]);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | undefined;

    supabase
      .from("events")
      .select("id, seq, type, payload, committed_at")
      .eq("session_id", sessionId)
      .order("seq", { ascending: true })
      .then(({ data }) => {
        if (!cancelled && data) {
          setEvents(data as FeedRow[]);
        }
      });

    // Realtime authorizes each subscriber by the JWT on its websocket, set
    // separately from the REST client's cookie-based session — and it has
    // to be set *before* the channel joins, not just before this component
    // renders. Subscribing first and calling setAuth after leaves a window
    // where the socket has already joined with no JWT, so postgres_changes
    // applies RLS as an anonymous request and silently delivers nothing —
    // no error, it just never arrives.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (session) {
        supabase.realtime.setAuth(session.access_token);
      }

      channel = supabase
        .channel(`events:${sessionId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "events",
            filter: `session_id=eq.${sessionId}`,
          },
          (payload) => {
            const row = payload.new as FeedRow;
            setEvents((prev) =>
              prev.some((e) => e.id === row.id) ? prev : [...prev, row].sort((a, b) => a.seq - b.seq),
            );
          },
        )
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [sessionId]);

  if (events.length === 0) {
    return <p className="font-mono text-sm text-ash-500">No events yet.</p>;
  }

  return (
    <ol className="flex flex-col gap-2">
      {events.map((event) => (
        <li key={event.id} className="plate flex items-baseline gap-3 px-4 py-2">
          <span className="font-mono text-xs tabular-nums text-ash-500">
            #{event.seq}
          </span>
          <span className="text-sm text-ash-100">{narrationText(event)}</span>
        </li>
      ))}
    </ol>
  );
}

"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type SessionEventRow = {
  id: string;
  seq: number;
  type: string;
  payload: Record<string, unknown>;
  committed_at: string;
};

/**
 * Every committed event in a session, live — the shared plumbing behind
 * LiveEventFeed and TvEventFeed. Same setAuth-before-subscribe fix as
 * every other Realtime hook in this codebase; see useCharacterEvents for
 * the full story of why that ordering matters.
 */
export function useSessionEvents(sessionId: string): SessionEventRow[] {
  const [events, setEvents] = useState<SessionEventRow[]>([]);

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
          setEvents(data as SessionEventRow[]);
        }
      });

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
            const row = payload.new as SessionEventRow;
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

  return events;
}

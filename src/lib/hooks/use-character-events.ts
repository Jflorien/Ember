"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type CharacterEventRow = {
  id: string;
  seq: number;
  type: string;
  payload: Record<string, unknown> & { targetId?: string };
};

/**
 * Fetches, then live-subscribes to, every committed event of the given
 * types targeting one character in one session — the shared plumbing
 * behind useCharacterHp and useCharacterConditions (and now
 * PartyStatusStrip's per-member tiles). Returns the raw matching events in
 * commit order; callers fold them into whatever derived state they need.
 *
 * Realtime authorizes each subscriber by the JWT on its own websocket, set
 * separately from the REST client's cookie session — setAuth has to
 * resolve *before* the channel subscribes, or postgres_changes silently
 * applies RLS as an anonymous connection and never delivers anything. See
 * the commit that first hit this (LiveEventFeed) for the full story.
 */
export function useCharacterEvents(
  sessionId: string,
  characterId: string,
  eventTypes: readonly string[],
): CharacterEventRow[] {
  const [events, setEvents] = useState<CharacterEventRow[]>([]);
  const typesKey = eventTypes.join(",");

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | undefined;
    const types = typesKey.split(",");

    supabase
      .from("events")
      .select("id, seq, type, payload")
      .eq("session_id", sessionId)
      .in("type", types)
      .order("seq", { ascending: true })
      .then(({ data }) => {
        if (cancelled || !data) return;
        const relevant = (data as CharacterEventRow[]).filter(
          (row) => row.payload?.targetId === characterId,
        );
        setEvents(relevant);
      });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (session) {
        supabase.realtime.setAuth(session.access_token);
      }

      channel = supabase
        .channel(`character-events:${characterId}:${typesKey}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "events",
            filter: `session_id=eq.${sessionId}`,
          },
          (payload) => {
            const row = payload.new as CharacterEventRow;
            if (!types.includes(row.type) || row.payload?.targetId !== characterId) return;
            setEvents((prev) => [...prev, row]);
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
  }, [sessionId, characterId, typesKey]);

  return events;
}

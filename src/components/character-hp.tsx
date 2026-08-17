"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { HpBar } from "@/components/hp-bar";

type HpEventRow = {
  id: string;
  seq: number;
  type: string;
  payload: { targetId?: string; amount?: number };
};

function isHpEvent(row: Pick<HpEventRow, "type" | "payload">, characterId: string) {
  return (
    (row.type === "damage" || row.type === "heal") &&
    row.payload?.targetId === characterId
  );
}

function fold(events: HpEventRow[], maxHp: number) {
  const delta = events.reduce((total, event) => {
    const amount = event.payload.amount ?? 0;
    return event.type === "heal" ? total + amount : total - amount;
  }, 0);
  return Math.max(0, Math.min(maxHp, maxHp + delta));
}

/**
 * HP is never stored — it's a live fold over every committed damage/heal
 * event for this character, recomputed on mount and updated incrementally
 * as new events arrive over Realtime. This is the thing CLAUDE.md means by
 * "HP living in a context window drifts within 20 minutes": the fix isn't
 * a more careful cache, it's not caching it at all.
 */
export function CharacterHp({
  sessionId,
  characterId,
  maxHp,
  label,
}: {
  sessionId: string;
  characterId: string;
  maxHp: number;
  label?: string;
}) {
  const [current, setCurrent] = useState(maxHp);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | undefined;

    supabase
      .from("events")
      .select("id, seq, type, payload")
      .eq("session_id", sessionId)
      .in("type", ["damage", "heal"])
      .order("seq", { ascending: true })
      .then(({ data }) => {
        if (cancelled || !data) return;
        const relevant = (data as HpEventRow[]).filter((row) => isHpEvent(row, characterId));
        setCurrent(fold(relevant, maxHp));
      });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (session) {
        supabase.realtime.setAuth(session.access_token);
      }

      channel = supabase
        .channel(`character-hp:${characterId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "events",
            filter: `session_id=eq.${sessionId}`,
          },
          (payload) => {
            const row = payload.new as HpEventRow;
            if (!isHpEvent(row, characterId)) return;
            setCurrent((prev) => {
              const amount = row.payload.amount ?? 0;
              const next = row.type === "heal" ? prev + amount : prev - amount;
              return Math.max(0, Math.min(maxHp, next));
            });
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
  }, [sessionId, characterId, maxHp]);

  return <HpBar current={current} max={maxHp} label={label} />;
}

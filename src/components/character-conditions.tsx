"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ConditionPill } from "@/components/condition-pill";

type ConditionEventRow = {
  id: string;
  seq: number;
  type: string;
  payload: {
    targetId?: string;
    condition?: string;
    action?: "apply" | "remove";
    durationRounds?: number | null;
  };
};

type ActiveState = Record<string, { active: boolean; durationRounds: number | null }>;

function isConditionEvent(row: Pick<ConditionEventRow, "type" | "payload">, characterId: string) {
  return row.type === "condition" && row.payload?.targetId === characterId;
}

function fold(events: ConditionEventRow[]): ActiveState {
  const state: ActiveState = {};
  for (const event of events) {
    const name = event.payload.condition;
    if (!name) continue;
    state[name] = {
      active: event.payload.action === "apply",
      durationRounds: event.payload.durationRounds ?? null,
    };
  }
  return state;
}

/**
 * Active conditions aren't stored either — same fold-over-events pattern as
 * CharacterHp, just keyed by condition name instead of summed. The last
 * apply/remove event for a given condition wins.
 */
export function CharacterConditions({
  sessionId,
  characterId,
}: {
  sessionId: string;
  characterId: string;
}) {
  const [conditions, setConditions] = useState<ActiveState>({});

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | undefined;

    supabase
      .from("events")
      .select("id, seq, type, payload")
      .eq("session_id", sessionId)
      .eq("type", "condition")
      .order("seq", { ascending: true })
      .then(({ data }) => {
        if (cancelled || !data) return;
        const relevant = (data as ConditionEventRow[]).filter((row) =>
          isConditionEvent(row, characterId),
        );
        setConditions(fold(relevant));
      });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (session) {
        supabase.realtime.setAuth(session.access_token);
      }

      channel = supabase
        .channel(`character-conditions:${characterId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "events",
            filter: `session_id=eq.${sessionId}`,
          },
          (payload) => {
            const row = payload.new as ConditionEventRow;
            if (!isConditionEvent(row, characterId)) return;
            const name = row.payload.condition;
            if (!name) return;
            setConditions((prev) => ({
              ...prev,
              [name]: {
                active: row.payload.action === "apply",
                durationRounds: row.payload.durationRounds ?? null,
              },
            }));
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
  }, [sessionId, characterId]);

  const active = Object.entries(conditions).filter(([, v]) => v.active);

  if (active.length === 0) {
    return <p className="font-mono text-sm text-ash-500">No active conditions.</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {active.map(([name, { durationRounds }]) => (
        <ConditionPill
          key={name}
          name={name}
          kind="debuff"
          duration={durationRounds ? `${durationRounds}r` : undefined}
        />
      ))}
    </div>
  );
}

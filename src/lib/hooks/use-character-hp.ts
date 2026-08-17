"use client";

import { useMemo } from "react";
import { useCharacterEvents } from "./use-character-events";

const HP_EVENT_TYPES = ["damage", "heal"] as const;

/**
 * HP is never stored — it's a live fold over every committed damage/heal
 * event for this character. This is the thing CLAUDE.md means by "HP
 * living in a context window drifts within 20 minutes": the fix isn't a
 * more careful cache, it's not caching it at all.
 */
export function useCharacterHp(sessionId: string, characterId: string, maxHp: number): number {
  const events = useCharacterEvents(sessionId, characterId, HP_EVENT_TYPES);

  return useMemo(() => {
    const delta = events.reduce((total, event) => {
      const amount = typeof event.payload.amount === "number" ? event.payload.amount : 0;
      return event.type === "heal" ? total + amount : total - amount;
    }, 0);
    return Math.max(0, Math.min(maxHp, maxHp + delta));
  }, [events, maxHp]);
}

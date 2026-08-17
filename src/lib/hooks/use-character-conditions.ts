"use client";

import { useMemo } from "react";
import { useCharacterEvents } from "./use-character-events";

const CONDITION_EVENT_TYPES = ["condition"] as const;

export type ActiveConditions = Record<string, { active: boolean; durationRounds: number | null }>;

/**
 * Active conditions aren't stored either — same fold-over-events pattern
 * as useCharacterHp, just keyed by condition name instead of summed. The
 * last apply/remove event for a given condition wins.
 */
export function useCharacterConditions(sessionId: string, characterId: string): ActiveConditions {
  const events = useCharacterEvents(sessionId, characterId, CONDITION_EVENT_TYPES);

  return useMemo(() => {
    const state: ActiveConditions = {};
    for (const event of events) {
      const name = event.payload.condition;
      if (typeof name !== "string") continue;
      state[name] = {
        active: event.payload.action === "apply",
        durationRounds: typeof event.payload.durationRounds === "number" ? event.payload.durationRounds : null,
      };
    }
    return state;
  }, [events]);
}

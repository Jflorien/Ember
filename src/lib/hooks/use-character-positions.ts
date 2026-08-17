"use client";

import { useMemo } from "react";
import { useSessionEvents } from "./use-session-events";
import type { Cell } from "@/lib/grid";

/** Every character's current position — last `move` event per actorId wins, folded live like everything else. */
export function useCharacterPositions(sessionId: string): Map<string, Cell> {
  const events = useSessionEvents(sessionId);

  return useMemo(() => {
    const positions = new Map<string, Cell>();
    for (const event of events) {
      if (event.type !== "move") continue;
      const payload = event.payload as { actorId?: string; to?: Cell };
      if (!payload.actorId || !payload.to) continue;
      positions.set(payload.actorId, payload.to);
    }
    return positions;
  }, [events]);
}

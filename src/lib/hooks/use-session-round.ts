"use client";

import { useMemo } from "react";
import { useSessionEvents } from "./use-session-events";

export type SessionRound = { number: number; phase: "start" | "end" } | null;

/**
 * Like useCharacterHp — never stored, just the last committed `round`
 * event folded into "where are we right now." null means the session
 * hasn't started its first round yet.
 */
export function useSessionRound(sessionId: string): SessionRound {
  const events = useSessionEvents(sessionId);

  return useMemo(() => {
    const roundEvents = events.filter((event) => event.type === "round");
    const last = roundEvents[roundEvents.length - 1];
    if (!last) return null;

    const number = typeof last.payload.number === "number" ? last.payload.number : null;
    const phase = last.payload.phase === "end" ? "end" : "start";
    return number === null ? null : { number, phase };
  }, [events]);
}

"use client";

import { useSessionRound } from "@/lib/hooks/use-session-round";

/**
 * Read-only round display for /table and /play — round advancement is a DM
 * call (RoundTracker), these surfaces only ever watch. Deliberately not
 * heated: "gold is turn state, concentration and legendary" — a round
 * number for the whole party isn't any one of those.
 */
export function RoundBadge({ sessionId }: { sessionId: string }) {
  const round = useSessionRound(sessionId);

  return (
    <div className="plate sm inline-flex items-center gap-2 px-3 py-1.5">
      <span className="runic">Round</span>
      <span className="font-mono text-sm tabular-nums text-ash-100">
        {round ? round.number : "—"}
      </span>
    </div>
  );
}

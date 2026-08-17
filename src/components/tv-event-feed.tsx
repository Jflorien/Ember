"use client";

import { useSessionEvents, type SessionEventRow } from "@/lib/hooks/use-session-events";

function narrationText(row: Pick<SessionEventRow, "type" | "payload">) {
  return typeof row.payload?.text === "string" ? row.payload.text : `[${row.type}]`;
}

/**
 * Rank 0 = newest. Four heat tiers, each pairing size *and* color so the
 * signal survives both a glance from across the room and a projector that
 * washes color out — "never rely on colour alone" from the design system.
 */
function tierForRank(rank: number) {
  if (rank === 0) {
    return {
      text: "text-2xl sm:text-3xl font-semibold text-forge-300",
      wrap: "plate px-6 py-5 [box-shadow:var(--glow-md)]",
      seq: "text-forge-500",
    };
  }
  if (rank === 1) {
    return {
      text: "text-xl text-molten-400",
      wrap: "plate px-5 py-4 [box-shadow:var(--glow-sm)]",
      seq: "text-molten-500",
    };
  }
  if (rank <= 3) {
    return {
      text: "text-base text-ash-200",
      wrap: "plate px-4 py-3",
      seq: "text-ash-400",
    };
  }
  return {
    text: "text-sm text-ash-500",
    wrap: "plate px-4 py-2.5 opacity-70",
    seq: "text-ash-500",
  };
}

/**
 * The TV-view rendering of a session's event log: newest event large and
 * molten-hot, older ones cooling and shrinking toward basalt as they
 * recede — "heat is state" applied to recency instead of just resources.
 * Same live data as LiveEventFeed (useSessionEvents), different heat map.
 */
export function TvEventFeed({ sessionId, limit = 8 }: { sessionId: string; limit?: number }) {
  const events = useSessionEvents(sessionId);

  if (events.length === 0) {
    return <p className="font-mono text-sm text-ash-500">Nothing has happened yet.</p>;
  }

  const newestFirst = [...events].reverse().slice(0, limit);

  return (
    <ol className="flex flex-col gap-3">
      {newestFirst.map((event, rank) => {
        const tier = tierForRank(rank);
        return (
          <li key={event.id} className={`flex items-baseline gap-4 ${tier.wrap}`}>
            <span className={`font-mono text-xs tabular-nums ${tier.seq}`}>#{event.seq}</span>
            <span className={tier.text}>{narrationText(event)}</span>
          </li>
        );
      })}
    </ol>
  );
}

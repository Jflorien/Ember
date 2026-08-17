"use client";

import { useSessionEvents } from "@/lib/hooks/use-session-events";
import { describeEvent } from "@/lib/events";

/**
 * Read-only, live view of a session's committed events. This is the "table
 * view" half of "one event end-to-end" — it never proposes anything, only
 * subscribes and renders what the DM console already committed.
 */
export function LiveEventFeed({ sessionId }: { sessionId: string }) {
  const events = useSessionEvents(sessionId);

  if (events.length === 0) {
    return <p className="font-mono text-sm text-ash-500">No events yet.</p>;
  }

  return (
    <ol className="flex flex-col gap-2">
      {events.map((event) => (
        <li key={event.id} className="plate flex items-baseline gap-3 px-4 py-2">
          <span className="font-mono text-xs tabular-nums text-ash-500">
            #{event.seq}
          </span>
          <span className="text-sm text-ash-100">{describeEvent(event)}</span>
        </li>
      ))}
    </ol>
  );
}

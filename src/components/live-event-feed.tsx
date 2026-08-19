"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useSessionEvents } from "@/lib/hooks/use-session-events";
import { describeEvent } from "@/lib/events";
import { revealEvent, type EventActionState, type PartyMember } from "@/app/dm/actions";

const initialState: EventActionState = {};

function visibilityLabel(visibility: string): string | null {
  if (visibility === "public") return null;
  if (visibility === "dm_only") return "DM only";
  if (visibility.startsWith("player:")) return "Player only";
  return null;
}

function RevealButton({ sessionId, eventId }: { sessionId: string; eventId: string }) {
  const action = revealEvent.bind(null, sessionId, eventId);
  const [state, formAction] = useActionState(action, initialState);
  const { pending } = useFormStatus();

  return (
    <form action={formAction}>
      <button
        type="submit"
        disabled={pending}
        className="text-xs font-semibold text-ash-500 hover:text-forge-400"
      >
        {pending ? "…" : "Reveal"}
      </button>
      {state.error && (
        <p className="text-xs text-[#ff8f92]" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}

/**
 * Read-only-ish live view of a session's committed events — "read-only"
 * except for Reveal, which never mutates a row (append-only), it only
 * proposes a new public one. This is the "table view" half of "one event
 * end-to-end": everything else here only subscribes and renders what the
 * DM console already committed.
 */
export function LiveEventFeed({
  sessionId,
  members = [],
}: {
  sessionId: string;
  members?: PartyMember[];
}) {
  const allEvents = useSessionEvents(sessionId);
  const nameFor = (id: string) =>
    members.find((member) => member.characterId === id)?.name;

  // Terrain placement is map authoring, not story. Drawing a room is dozens
  // of events, and leaving them in buries the narrative under "wall placed
  // at 3, 2" — the map itself is where terrain is verified. `destroy` stays:
  // something being wrecked is a beat the table cares about.
  const events = allEvents.filter((event) => event.type !== "terrain");

  if (events.length === 0) {
    return <p className="font-mono text-sm text-ash-500">No events yet.</p>;
  }

  // Newest first: in a rail you read the top, and the DM cares about what
  // just happened, not what happened at the start of the session.
  return (
    <ol className="flex flex-col-reverse justify-end gap-2">
      {events.map((event) => {
        const badge = visibilityLabel(event.visibility);
        return (
          <li key={event.id} className="plate flex items-baseline gap-3 px-4 py-2">
            <span className="font-mono text-xs tabular-nums text-ash-500">#{event.seq}</span>
            <span className="flex-1 text-sm text-ash-100">{describeEvent(event, nameFor)}</span>
            {badge && (
              <span className="runic shrink-0 text-molten-400">{badge}</span>
            )}
            {event.visibility === "dm_only" && (
              <RevealButton sessionId={sessionId} eventId={event.id} />
            )}
          </li>
        );
      })}
    </ol>
  );
}

"use client";

import { useActionState } from "react";
import { proposeAdvanceRoundEvent, type EventActionState } from "@/app/dm/actions";
import { useSessionRound, type SessionRound } from "@/lib/hooks/use-session-round";
import { SubmitButton } from "@/components/submit-button";

const initialState: EventActionState = {};

function nextLabel(round: SessionRound) {
  if (!round) return "Start round 1";
  if (round.phase === "start") return `End round ${round.number}`;
  return `Start round ${round.number + 1}`;
}

/**
 * The DM's round counter. Advancing never sends a number — the server
 * recomputes it from the last committed round event (proposeAdvanceRoundEvent),
 * the same "don't trust client state" shape as attack's dice rolls.
 */
export function RoundTracker({ sessionId }: { sessionId: string }) {
  const round = useSessionRound(sessionId);
  const action = proposeAdvanceRoundEvent.bind(null, sessionId);
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form
      action={formAction}
      className="plate flex flex-wrap items-center justify-between gap-3 p-4"
    >
      <div className="flex items-center gap-3">
        <span className="runic">Round</span>
        <span className="font-mono text-lg tabular-nums text-ash-100">
          {round ? round.number : "—"}
        </span>
        {round?.phase === "end" && <span className="text-xs text-ash-500">ending</span>}
      </div>
      <SubmitButton>{nextLabel(round)}</SubmitButton>
      {state.error && (
        <p className="w-full text-sm text-[#ff8f92]" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}

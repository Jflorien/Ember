"use client";

import { useActionState, useState } from "react";
import { proposeDeathEvent, type EventActionState, type PartyMember } from "@/app/dm/actions";
import { SubmitButton } from "@/components/submit-button";
import { VisibilitySelect } from "@/components/visibility-select";

const initialState: EventActionState = {};

/**
 * DM-only, and behind a confirm step. Death is the one event with no
 * counterpart — there's no revival event yet, so committing this moves the
 * character to the Fallen list on its owner's roster permanently. The log is
 * append-only, so this can't be taken back by deleting it either.
 */
export function DeathComposer({
  sessionId,
  targetId,
  targetName,
  members,
}: {
  sessionId: string;
  targetId: string;
  targetName: string;
  members?: PartyMember[];
}) {
  const action = proposeDeathEvent.bind(null, sessionId, targetId);
  const [state, formAction] = useActionState(action, initialState);
  const [armed, setArmed] = useState(false);

  return (
    <form action={formAction} className="plate flex flex-wrap items-end gap-3 border-l-2 border-l-danger p-4">
      <span className="runic w-full">Death</span>

      {!armed ? (
        <>
          <p className="w-full text-xs text-ash-400">
            Marks {targetName} as dead. No revival mechanic exists yet — this is permanent.
          </p>
          <button type="button" onClick={() => setArmed(true)} className="btn btn-iron">
            Declare death…
          </button>
        </>
      ) : (
        <>
          <input
            name="cause"
            type="text"
            placeholder={`How did ${targetName} die?`}
            className="min-w-[8rem] flex-1 bg-basalt-900 px-3 py-2 text-sm text-ash-100 placeholder:text-ash-500 focus:outline-none focus:shadow-[inset_0_0_0_1px_var(--forge-500)]"
          />
          {members && <VisibilitySelect members={members} />}
          <button type="button" onClick={() => setArmed(false)} className="btn btn-iron">
            Cancel
          </button>
          <SubmitButton>Confirm death</SubmitButton>
        </>
      )}

      {state.error && (
        <p className="w-full text-sm text-[#ff8f92]" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { proposeConditionEvent, type EventActionState, type PartyMember } from "@/app/dm/actions";
import { CONDITIONS } from "@/lib/events";
import { SubmitButton } from "@/components/submit-button";
import { VisibilitySelect } from "@/components/visibility-select";

const initialState: EventActionState = {};

/** `members` is optional and DM-only — see AttackComposer for why. */
export function ConditionComposer({
  sessionId,
  targetId,
  members,
}: {
  sessionId: string;
  targetId: string;
  members?: PartyMember[];
}) {
  const action = proposeConditionEvent.bind(null, sessionId, targetId);
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form action={formAction} className="plate flex flex-col gap-3 p-4">
      <span className="runic">Condition</span>
      <div className="flex flex-wrap gap-2">
        <select
          name="condition"
          defaultValue={CONDITIONS[0]}
          className="flex-1 bg-basalt-900 px-3 py-2 text-sm text-ash-100 focus:outline-none focus:shadow-[inset_0_0_0_1px_var(--forge-500)]"
        >
          {CONDITIONS.map((condition) => (
            <option key={condition} value={condition}>
              {condition}
            </option>
          ))}
        </select>
        <select
          name="action"
          defaultValue="apply"
          className="bg-basalt-900 px-3 py-2 text-sm text-ash-100 focus:outline-none focus:shadow-[inset_0_0_0_1px_var(--forge-500)]"
        >
          <option value="apply">Apply</option>
          <option value="remove">Remove</option>
        </select>
        <input
          name="durationRounds"
          type="number"
          min={1}
          step={1}
          placeholder="Rounds (optional)"
          className="w-36 bg-basalt-900 px-3 py-2 text-sm text-ash-100 placeholder:text-ash-500 focus:outline-none focus:shadow-[inset_0_0_0_1px_var(--forge-500)]"
        />
      </div>
      {members && <VisibilitySelect members={members} />}
      <SubmitButton>Commit</SubmitButton>
      {state.error && (
        <p className="text-sm text-[#ff8f92]" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { proposeAttackEvent, type EventActionState, type PartyMember } from "@/app/dm/actions";
import { SubmitButton } from "@/components/submit-button";
import { VisibilitySelect } from "@/components/visibility-select";

const initialState: EventActionState = {};

/**
 * Rolls the die server-side (see proposeAttackEvent / src/lib/dice.ts) —
 * this form only ever sends the modifier and advantage state, never a
 * result. attackerId/targetId come from TargetedComposers' two pickers.
 * `members` is optional and DM-only — PlayerActionPanel omits it, so a
 * player's own attack has no visibility control and defaults to public.
 */
export function AttackComposer({
  sessionId,
  attackerId,
  targetId,
  members,
}: {
  sessionId: string;
  attackerId: string;
  targetId: string;
  members?: PartyMember[];
}) {
  const action = proposeAttackEvent.bind(null, sessionId, attackerId, targetId);
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form action={formAction} className="plate flex flex-wrap items-end gap-3 p-4">
      <span className="runic w-full">Attack</span>
      <input
        name="modifier"
        type="number"
        step={1}
        defaultValue={0}
        placeholder="Modifier"
        className="w-24 bg-basalt-900 px-3 py-2 text-sm text-ash-100 placeholder:text-ash-500 focus:outline-none focus:shadow-[inset_0_0_0_1px_var(--forge-500)]"
      />
      <select
        name="advantage"
        defaultValue="normal"
        className="bg-basalt-900 px-3 py-2 text-sm text-ash-100 focus:outline-none focus:shadow-[inset_0_0_0_1px_var(--forge-500)]"
      >
        <option value="normal">Normal</option>
        <option value="advantage">Advantage</option>
        <option value="disadvantage">Disadvantage</option>
      </select>
      {members && <VisibilitySelect members={members} />}
      <SubmitButton>Roll attack</SubmitButton>
      {state.error && (
        <p className="w-full text-sm text-[#ff8f92]" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}

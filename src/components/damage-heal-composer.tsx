"use client";

import { useActionState } from "react";
import {
  proposeDamageEvent,
  proposeHealEvent,
  type EventActionState,
  type PartyMember,
} from "@/app/dm/actions";
import { DAMAGE_TYPES } from "@/lib/events";
import { SubmitButton } from "@/components/submit-button";
import { VisibilitySelect } from "@/components/visibility-select";

const initialState: EventActionState = {};

/** `members` is optional and DM-only — see AttackComposer for why. */
export function DamageHealComposer({
  sessionId,
  targetId,
  members,
}: {
  sessionId: string;
  targetId: string;
  members?: PartyMember[];
}) {
  const damageAction = proposeDamageEvent.bind(null, sessionId, targetId);
  const healAction = proposeHealEvent.bind(null, sessionId, targetId);
  const [damageState, damageFormAction] = useActionState(damageAction, initialState);
  const [healState, healFormAction] = useActionState(healAction, initialState);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <form action={damageFormAction} className="plate flex flex-col gap-3 p-4">
        <span className="runic">Damage</span>
        <div className="flex gap-2">
          <input
            name="amount"
            type="number"
            min={1}
            step={1}
            required
            placeholder="Amount"
            className="w-24 bg-basalt-900 px-3 py-2 text-sm text-ash-100 placeholder:text-ash-500 focus:outline-none focus:shadow-[inset_0_0_0_1px_var(--forge-500)]"
          />
          <select
            name="damageType"
            defaultValue="slashing"
            className="flex-1 bg-basalt-900 px-3 py-2 text-sm text-ash-100 focus:outline-none focus:shadow-[inset_0_0_0_1px_var(--forge-500)]"
          >
            {DAMAGE_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
        {members && <VisibilitySelect members={members} />}
        <SubmitButton>Deal damage</SubmitButton>
        {damageState.error && (
          <p className="text-sm text-[#ff8f92]" role="alert">
            {damageState.error}
          </p>
        )}
      </form>

      <form action={healFormAction} className="plate flex flex-col gap-3 p-4">
        <span className="runic">Heal</span>
        <input
          name="amount"
          type="number"
          min={1}
          step={1}
          required
          placeholder="Amount"
          className="w-24 bg-basalt-900 px-3 py-2 text-sm text-ash-100 placeholder:text-ash-500 focus:outline-none focus:shadow-[inset_0_0_0_1px_var(--forge-500)]"
        />
        {members && <VisibilitySelect members={members} />}
        <SubmitButton>Heal</SubmitButton>
        {healState.error && (
          <p className="text-sm text-[#ff8f92]" role="alert">
            {healState.error}
          </p>
        )}
      </form>
    </div>
  );
}

"use client";

import { useActionState } from "react";
import { proposeLootEvent, type EventActionState, type PartyMember } from "@/app/dm/actions";
import { SubmitButton } from "@/components/submit-button";
import { VisibilitySelect } from "@/components/visibility-select";

const initialState: EventActionState = {};

/**
 * DM Console Panels, panel 9: freeform item name + quantity, assigned to
 * the campaign's selected target — no item catalog needed, since the loot
 * payload's items are just name/quantity/nullable-itemId.
 */
export function LootComposer({
  sessionId,
  targetId,
  members,
}: {
  sessionId: string;
  targetId: string;
  members?: PartyMember[];
}) {
  const action = proposeLootEvent.bind(null, sessionId, targetId);
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form action={formAction} className="plate flex flex-wrap items-end gap-3 p-4">
      <span className="runic w-full">Loot</span>
      <input
        name="name"
        type="text"
        required
        placeholder="Item name"
        className="min-w-[8rem] flex-1 bg-basalt-900 px-3 py-2 text-sm text-ash-100 placeholder:text-ash-500 focus:outline-none focus:shadow-[inset_0_0_0_1px_var(--forge-500)]"
      />
      <input
        name="quantity"
        type="number"
        min={1}
        step={1}
        defaultValue={1}
        className="w-20 bg-basalt-900 px-3 py-2 text-sm text-ash-100 focus:outline-none focus:shadow-[inset_0_0_0_1px_var(--forge-500)]"
      />
      {members && <VisibilitySelect members={members} />}
      <SubmitButton>Give loot</SubmitButton>
      {state.error && (
        <p className="w-full text-sm text-[#ff8f92]" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}

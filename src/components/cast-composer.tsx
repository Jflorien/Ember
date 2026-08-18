"use client";

import { useActionState } from "react";
import {
  proposeCastEvent,
  type EventActionState,
  type PartyMember,
  type Spell,
} from "@/app/dm/actions";
import { SubmitButton } from "@/components/submit-button";
import { VisibilitySelect } from "@/components/visibility-select";

const initialState: EventActionState = {};

/**
 * casterId/targetId reuse TargetedComposers' Attacker/Target pickers — one
 * target for now, matching every other single-target composer here. No
 * "known spells" filter yet, so the picker is the full compendium.
 */
export function CastComposer({
  sessionId,
  casterId,
  targetId,
  spells,
  members,
}: {
  sessionId: string;
  casterId: string;
  targetId: string;
  spells: Spell[];
  members?: PartyMember[];
}) {
  const action = proposeCastEvent.bind(null, sessionId, casterId);
  const [state, formAction] = useActionState(action, initialState);

  if (spells.length === 0) {
    return null;
  }

  return (
    <form action={formAction} className="plate flex flex-wrap items-end gap-3 p-4">
      <span className="runic w-full">Cast</span>
      <select
        name="spellId"
        defaultValue={spells[0]?.id}
        className="min-w-[10rem] flex-1 bg-basalt-900 px-3 py-2 text-sm text-ash-100 focus:outline-none focus:shadow-[inset_0_0_0_1px_var(--forge-500)]"
      >
        {spells.map((spell) => (
          <option key={spell.id} value={spell.id}>
            {spell.level === 0 ? "Cantrip" : `Lv ${spell.level}`} — {spell.name}
          </option>
        ))}
      </select>
      <input type="hidden" name="targetIds" value={targetId} />
      <select
        name="slotLevel"
        defaultValue=""
        className="w-28 bg-basalt-900 px-3 py-2 text-sm text-ash-100 focus:outline-none focus:shadow-[inset_0_0_0_1px_var(--forge-500)]"
      >
        <option value="">Cantrip</option>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((lvl) => (
          <option key={lvl} value={lvl}>
            Slot {lvl}
          </option>
        ))}
      </select>
      <label className="flex items-center gap-2 text-sm text-ash-300">
        <input type="checkbox" name="concentration" value="true" className="accent-forge-500" />
        Concentration
      </label>
      {members && <VisibilitySelect members={members} />}
      <SubmitButton>Cast spell</SubmitButton>
      {state.error && (
        <p className="w-full text-sm text-[#ff8f92]" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}

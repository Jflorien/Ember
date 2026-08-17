"use client";

import { useActionState } from "react";
import { createCharacter, type EventActionState } from "@/app/dm/actions";
import { SubmitButton } from "@/components/submit-button";

const initialState: EventActionState = {};

export function CreateCharacterForm({ campaignId }: { campaignId: string }) {
  const action = createCharacter.bind(null, campaignId);
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form action={formAction} className="plate flex flex-col gap-3 p-6">
      <span className="runic hot">Create your character</span>
      <p className="text-sm text-ash-300">
        Race, ability scores, and full stats need SRD content that isn&rsquo;t
        seeded yet. Every character starts at 20 max HP.
      </p>
      <div className="field max-w-none">
        <label htmlFor="character-name">Character name</label>
        <input id="character-name" name="name" type="text" required placeholder="Rowan Ashbound" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="field max-w-none">
          <label htmlFor="character-class">Class</label>
          <input id="character-class" name="class" type="text" placeholder="Wildfire Barbarian" />
        </div>
        <div className="field max-w-none">
          <label htmlFor="character-level">Level</label>
          <input
            id="character-level"
            name="level"
            type="number"
            min={1}
            max={20}
            step={1}
            defaultValue={1}
          />
        </div>
      </div>
      <SubmitButton>Create character</SubmitButton>
      {state.error && (
        <p className="text-sm text-[#ff8f92]" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}

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
        Just a name for now — class, race, and stats need SRD content that
        isn&rsquo;t seeded yet. Every character starts at 20 max HP.
      </p>
      <div className="field max-w-none">
        <label htmlFor="character-name">Character name</label>
        <input id="character-name" name="name" type="text" required placeholder="Rowan Ashbound" />
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

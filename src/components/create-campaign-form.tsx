"use client";

import { useActionState } from "react";
import { createCampaign, type EventActionState } from "@/app/dm/actions";
import { SubmitButton } from "@/components/submit-button";

const initialState: EventActionState = {};

export function CreateCampaignForm() {
  const [state, formAction] = useActionState(createCampaign, initialState);

  return (
    <form action={formAction} className="plate flex flex-col gap-3 p-6">
      <span className="runic hot">First campaign</span>
      <p className="text-sm text-ash-300">
        This is the table you&rsquo;ll run. You can invite players once it exists.
      </p>
      <div className="field max-w-none">
        <label htmlFor="campaign-name">Campaign name</label>
        <input id="campaign-name" name="name" type="text" required placeholder="The Sunken Vault" />
      </div>
      <SubmitButton>Create campaign</SubmitButton>
      {state.error && (
        <p className="text-sm text-[#ff8f92]" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { joinCampaignAction, type EventActionState } from "@/app/dm/actions";
import { SubmitButton } from "@/components/submit-button";

const initialState: EventActionState = {};

export function JoinCampaignForm() {
  const [state, formAction] = useActionState(joinCampaignAction, initialState);

  return (
    <form action={formAction} className="plate flex flex-col gap-3 p-6">
      <span className="runic hot">Join a campaign</span>
      <p className="text-sm text-ash-300">
        Ask your DM for the invite code from their console.
      </p>
      <div className="field max-w-none">
        <label htmlFor="invite-code">Invite code</label>
        <input
          id="invite-code"
          name="code"
          type="text"
          required
          autoCapitalize="characters"
          placeholder="ABCD1234"
          className="font-mono uppercase tracking-widest"
        />
      </div>
      <SubmitButton>Join</SubmitButton>
      {state.error && (
        <p className="text-sm text-[#ff8f92]" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}

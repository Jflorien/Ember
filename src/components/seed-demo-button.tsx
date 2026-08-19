"use client";

import { useActionState } from "react";
import { seedDemoCampaign } from "@/app/dm/demo-actions";
import type { EventActionState } from "@/app/dm/actions";
import { SubmitButton } from "@/components/submit-button";

const initialState: EventActionState = {};

/**
 * seedDemoCampaign takes no form input, so the bound action has fewer
 * parameters than useActionState's signature — allowed by structural typing,
 * same pattern as proposeAdvanceRoundEvent and regenerateInviteCode.
 */
export function SeedDemoButton({ label = "Load example encounter" }: { label?: string }) {
  const [state, formAction] = useActionState(seedDemoCampaign, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <SubmitButton>{label}</SubmitButton>
      {state.error && (
        <p className="text-sm text-[#ff8f92]" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}

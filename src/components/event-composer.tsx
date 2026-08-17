"use client";

import { useActionState, useRef } from "react";
import { proposeNarrationEvent, type EventActionState, type PartyMember } from "@/app/dm/actions";
import { SubmitButton } from "@/components/submit-button";
import { VisibilitySelect } from "@/components/visibility-select";

const initialState: EventActionState = {};

export function EventComposer({
  sessionId,
  members,
}: {
  sessionId: string;
  members: PartyMember[];
}) {
  const action = proposeNarrationEvent.bind(null, sessionId);
  const [state, formAction] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await formAction(formData);
        formRef.current?.reset();
      }}
      className="flex items-end gap-3"
    >
      <div className="field max-w-none flex-1">
        <label htmlFor="narration-text">Narration</label>
        <input
          id="narration-text"
          name="text"
          type="text"
          autoComplete="off"
          placeholder="The door creaks open…"
          required
        />
      </div>
      <VisibilitySelect members={members} />
      <SubmitButton>Propose</SubmitButton>
      {state.error && (
        <p className="text-sm text-[#ff8f92]" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}

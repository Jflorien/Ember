"use client";

import { useActionState, useRef } from "react";
import { proposeNarrationEvent, type EventActionState } from "@/app/dm/actions";
import { SubmitButton } from "@/components/submit-button";

const initialState: EventActionState = {};

export function EventComposer({ sessionId }: { sessionId: string }) {
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
      <SubmitButton>Propose</SubmitButton>
      {state.error && (
        <p className="text-sm text-[#ff8f92]" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}

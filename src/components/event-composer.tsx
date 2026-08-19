"use client";

import { useActionState, useRef, useState } from "react";
import { proposeNarrationEvent, type EventActionState, type PartyMember } from "@/app/dm/actions";
import { suggestNarration, type SuggestNarrationState } from "@/app/dm/ai-actions";
import { SubmitButton } from "@/components/submit-button";
import { VisibilitySelect } from "@/components/visibility-select";

const initialState: EventActionState = {};
const initialSuggestState: SuggestNarrationState = {};

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

  const [text, setText] = useState("");
  const [aiSuggested, setAiSuggested] = useState(false);
  const [copilotPrompt, setCopilotPrompt] = useState("");

  const suggestAction = suggestNarration.bind(null, sessionId);
  const [suggestState, suggestFormAction] = useActionState(
    async (_prev: SuggestNarrationState, formData: FormData) => {
      const result = await suggestAction(_prev, formData);
      if (result.suggestion) {
        setText(result.suggestion);
        setAiSuggested(true);
      }
      return result;
    },
    initialSuggestState,
  );

  return (
    <div className="flex flex-col gap-2">
      <form
        ref={formRef}
        action={async (formData) => {
          await formAction(formData);
          formRef.current?.reset();
          setText("");
          setAiSuggested(false);
        }}
        className="flex flex-col gap-3"
      >
        <div className="field max-w-none">
          <label htmlFor="narration-text">Narration</label>
          <input
            id="narration-text"
            name="text"
            type="text"
            autoComplete="off"
            placeholder="The door creaks open…"
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              setAiSuggested(false);
            }}
            required
          />
        </div>
        <input type="hidden" name="proposedBy" value={aiSuggested ? "model" : "human"} />
        <VisibilitySelect members={members} />
        <SubmitButton>Propose</SubmitButton>
        {state.error && (
          <p className="text-sm text-[#ff8f92]" role="alert">
            {state.error}
          </p>
        )}
      </form>

      <form
        action={suggestFormAction}
        className="flex flex-col gap-3 border-t border-basalt-700 pt-3"
      >
        <div className="field max-w-none">
          <label htmlFor="copilot-prompt">AI co-pilot</label>
          <input
            id="copilot-prompt"
            name="prompt"
            type="text"
            autoComplete="off"
            placeholder="the party opens the door…"
            value={copilotPrompt}
            onChange={(event) => setCopilotPrompt(event.target.value)}
          />
        </div>
        <SubmitButton>Suggest</SubmitButton>
        {suggestState.error && (
          <p className="text-sm text-[#ff8f92]" role="alert">
            {suggestState.error}
          </p>
        )}
      </form>
    </div>
  );
}

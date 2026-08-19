"use client";

import { useActionState, useRef } from "react";
import { updateCharacterPortrait, type EventActionState } from "@/app/dm/actions";
import { PortraitThumb } from "@/components/portrait-thumb";

const initialState: EventActionState = {};

export function CharacterPortraitUpload({
  characterId,
  currentUrl,
  name,
}: {
  characterId: string;
  currentUrl: string | null;
  name: string;
}) {
  const action = updateCharacterPortrait.bind(null, characterId);
  const [state, formAction, isPending] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={formAction} className="flex items-center gap-3">
      <PortraitThumb url={currentUrl} name={name} size={56} />
      <div className="flex flex-col gap-1">
        <label className="text-xs text-ash-400">
          {isPending ? "Uploading…" : currentUrl ? "Change portrait" : "Add a portrait"}
          <input
            type="file"
            name="portrait"
            accept="image/png,image/jpeg,image/webp,image/gif"
            disabled={isPending}
            onChange={() => formRef.current?.requestSubmit()}
            className="mt-1 block max-w-[220px] text-xs text-ash-400 file:mr-2 file:cursor-pointer file:border-0 file:bg-basalt-800 file:px-2 file:py-1 file:text-xs file:text-ash-100 file:hover:bg-basalt-700"
          />
        </label>
        {state.error && (
          <p className="text-xs text-[#ff8f92]" role="alert">
            {state.error}
          </p>
        )}
      </div>
    </form>
  );
}

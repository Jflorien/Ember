"use client";

import { useActionState, useState } from "react";
import { regenerateInviteCode, type EventActionState } from "@/app/dm/actions";
import { SubmitButton } from "@/components/submit-button";

const initialState: EventActionState = {};

export function InviteCodeDisplay({
  campaignId,
  inviteCode,
}: {
  campaignId: string;
  inviteCode: string;
}) {
  const [copied, setCopied] = useState(false);
  const joinUrl =
    typeof window !== "undefined" ? `${window.location.origin}/join/${inviteCode}` : "";

  const regenerateAction = regenerateInviteCode.bind(null, campaignId);
  const [state, formAction] = useActionState(regenerateAction, initialState);

  function handleCopy() {
    if (!joinUrl) return;
    navigator.clipboard.writeText(joinUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="plate flex flex-wrap items-center justify-between gap-3 p-4">
      <div>
        <span className="runic">Invite players</span>
        <p className="mt-1 font-mono text-lg tracking-widest text-forge-300">{inviteCode}</p>
        {state.error && (
          <p className="mt-1 text-sm text-[#ff8f92]" role="alert">
            {state.error}
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={handleCopy} className="btn btn-iron">
          {copied ? "Copied" : "Copy join link"}
        </button>
        <form action={formAction}>
          <SubmitButton>Regenerate</SubmitButton>
        </form>
      </div>
    </div>
  );
}

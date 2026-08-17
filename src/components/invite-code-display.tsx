"use client";

import { useState } from "react";

export function InviteCodeDisplay({ inviteCode }: { inviteCode: string }) {
  const [copied, setCopied] = useState(false);
  const joinUrl =
    typeof window !== "undefined" ? `${window.location.origin}/join/${inviteCode}` : "";

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
      </div>
      <button type="button" onClick={handleCopy} className="btn btn-iron">
        {copied ? "Copied" : "Copy join link"}
      </button>
    </div>
  );
}

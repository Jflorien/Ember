"use client";

import { useTransition } from "react";
import { signInWithOAuth } from "@/app/auth/actions";
import { DiscordIcon, GoogleIcon } from "@/components/icons";

export function OAuthButtons() {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        disabled={isPending}
        onClick={() => startTransition(() => signInWithOAuth("discord"))}
        className="flex h-11 items-center justify-center gap-2.5 bg-[#5865F2]/15 text-sm font-medium text-ash-100 shadow-[inset_0_0_0_1px_rgba(88,101,242,.5)] transition-colors [clip-path:polygon(9px_0,100%_0,100%_calc(100%-9px),calc(100%-9px)_100%,0_100%,0_9px)] hover:bg-[#5865F2]/25 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <DiscordIcon className="h-4 w-4 text-[#5865F2]" />
        Continue with Discord
      </button>
      <button
        type="button"
        disabled={isPending}
        onClick={() => startTransition(() => signInWithOAuth("google"))}
        className="btn btn-iron flex h-11 items-center justify-center gap-2.5"
      >
        <GoogleIcon className="h-4 w-4" />
        Continue with Google
      </button>
    </div>
  );
}

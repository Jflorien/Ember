"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signIn, type AuthState } from "@/app/auth/actions";
import { SubmitButton } from "@/components/submit-button";

const initialState: AuthState = {};

export function LoginForm({ initialError }: { initialError?: string }) {
  const [state, formAction] = useActionState(signIn, initialState);

  const error = state.error ?? initialError;

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {error && (
        <p className="border-l-2 border-danger bg-danger/10 px-4 py-3 text-sm text-[#ff8f92]">
          {error}
        </p>
      )}

      <div className="field max-w-none">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
        />
      </div>

      <div className="field max-w-none">
        <div className="mb-1.5 flex items-center justify-between">
          <label htmlFor="password" className="!mb-0">
            Password
          </label>
          <Link
            href="/login/forgot-password"
            className="text-xs text-ash-400 hover:text-forge-400"
          >
            Forgot password?
          </Link>
        </div>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••••"
        />
      </div>

      <SubmitButton>Log in</SubmitButton>
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { signUp, type AuthState } from "@/app/auth/actions";
import { SubmitButton } from "@/components/submit-button";

const initialState: AuthState = {};

export function SignupForm() {
  const [state, formAction] = useActionState(signUp, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {state.error && (
        <p className="border-l-2 border-danger bg-danger/10 px-4 py-3 text-sm text-[#ff8f92]">
          {state.error}
        </p>
      )}

      <div className="field max-w-none">
        <label htmlFor="displayName">Display name</label>
        <input
          id="displayName"
          name="displayName"
          type="text"
          autoComplete="nickname"
          required
          placeholder="Elminster"
        />
      </div>

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
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          placeholder="At least 8 characters"
        />
      </div>

      <label className="flex items-start gap-2.5 text-sm text-ash-300">
        <input
          type="checkbox"
          name="terms"
          required
          className="mt-0.5 h-4 w-4 shrink-0 bg-basalt-900 text-forge-500 shadow-[inset_0_0_0_1px_var(--basalt-600)] focus:ring-1 focus:ring-forge-500"
        />
        <span>
          I agree to the{" "}
          <a href="#" className="text-forge-400 hover:underline">
            Terms of Service
          </a>{" "}
          and{" "}
          <a href="#" className="text-forge-400 hover:underline">
            Privacy Policy
          </a>
          .
        </span>
      </label>

      <SubmitButton>Create account</SubmitButton>
    </form>
  );
}

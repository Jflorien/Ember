"use client";

import { useActionState } from "react";
import { requestPasswordReset, type AuthState } from "@/app/auth/actions";
import { SubmitButton } from "@/components/submit-button";

const initialState: AuthState = {};

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(
    requestPasswordReset,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {state.error && (
        <p className="border-l-2 border-danger bg-danger/10 px-4 py-3 text-sm text-[#ff8f92]">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="border-l-2 border-verdant bg-verdant/10 px-4 py-3 text-sm text-verdant">
          {state.success}
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

      <SubmitButton>Send reset link</SubmitButton>
    </form>
  );
}

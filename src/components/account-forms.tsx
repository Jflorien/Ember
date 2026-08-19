"use client";

import { useActionState, useState, useTransition } from "react";
import {
  updateEmail,
  updatePassword,
  exportMyData,
  deleteMyAccount,
  type AuthState,
} from "@/app/auth/actions";
import { SubmitButton } from "@/components/submit-button";

const initialState: AuthState = {};

function Feedback({ state }: { state: AuthState }) {
  if (state.error) {
    return (
      <p className="text-sm text-[#ff8f92]" role="alert">
        {state.error}
      </p>
    );
  }
  if (state.success) {
    return (
      <p className="text-sm text-verdant" role="status">
        {state.success}
      </p>
    );
  }
  return null;
}

export function EmailForm({ currentEmail }: { currentEmail: string }) {
  const [state, formAction] = useActionState(updateEmail, initialState);

  return (
    <form action={formAction} className="plate flex flex-col gap-3 p-6">
      <span className="runic">Email address</span>
      <p className="font-mono text-xs text-ash-500">Currently {currentEmail}</p>
      <div className="field max-w-none">
        <label htmlFor="account-email">New email</label>
        <input
          id="account-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
        />
      </div>
      <SubmitButton>Update email</SubmitButton>
      <Feedback state={state} />
    </form>
  );
}

export function PasswordForm() {
  const [state, formAction] = useActionState(updatePassword, initialState);

  return (
    <form action={formAction} className="plate flex flex-col gap-3 p-6">
      <span className="runic">Password</span>
      <div className="field max-w-none">
        <label htmlFor="current-password">Current password</label>
        <input
          id="current-password"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <div className="field max-w-none">
        <label htmlFor="new-password">New password</label>
        <input
          id="new-password"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>
      <div className="field max-w-none">
        <label htmlFor="confirm-password">Confirm new password</label>
        <input
          id="confirm-password"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>
      <SubmitButton>Change password</SubmitButton>
      <Feedback state={state} />
    </form>
  );
}

export function DataExportPanel() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleExport() {
    setError(null);
    startTransition(async () => {
      const result = await exportMyData();
      if (result.error || !result.data) {
        setError(result.error ?? "Export failed.");
        return;
      }
      // Built and revoked client-side — the JSON never becomes a file on the
      // server, so there's nothing to clean up or accidentally leave served.
      const url = URL.createObjectURL(
        new Blob([result.data], { type: "application/json" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `ember-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    });
  }

  return (
    <div className="plate flex flex-col gap-3 p-6">
      <span className="runic">Export your data</span>
      <p className="text-sm text-ash-300">
        Downloads everything this account owns — profile, campaigns, characters, and every
        event it&rsquo;s allowed to read — as a single JSON file.
      </p>
      <button
        type="button"
        onClick={handleExport}
        disabled={pending}
        className="btn btn-iron w-full disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Preparing…" : "Download my data"}
      </button>
      {error && (
        <p className="text-sm text-[#ff8f92]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function DeleteAccountForm({
  email,
  ownedCampaigns,
}: {
  email: string;
  ownedCampaigns: string[];
}) {
  const [state, formAction] = useActionState(deleteMyAccount, initialState);
  const [armed, setArmed] = useState(false);

  return (
    <div className="plate flex flex-col gap-3 border-l-2 border-l-danger p-6">
      <span className="runic">Delete account</span>
      <p className="text-sm text-ash-300">
        Permanent and immediate. There is no undo and no grace period.
      </p>

      {ownedCampaigns.length > 0 && (
        <div className="border-l-2 border-danger bg-danger/10 px-4 py-3">
          <p className="text-sm text-[#ff8f92]">
            You are the DM of {ownedCampaigns.length}{" "}
            {ownedCampaigns.length === 1 ? "campaign" : "campaigns"} —{" "}
            {ownedCampaigns.join(", ")}. Deleting your account deletes{" "}
            {ownedCampaigns.length === 1 ? "it" : "them"} too, along with every character,
            session and event inside, for every player at those tables.
          </p>
        </div>
      )}

      {!armed ? (
        <button type="button" onClick={() => setArmed(true)} className="btn btn-iron w-full">
          Delete my account…
        </button>
      ) : (
        <form action={formAction} className="flex flex-col gap-3">
          <div className="field max-w-none">
            <label htmlFor="delete-confirmation">
              Type <span className="font-mono text-ash-100">{email}</span> to confirm
            </label>
            <input
              id="delete-confirmation"
              name="confirmation"
              type="text"
              autoComplete="off"
              required
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setArmed(false)}
              className="btn btn-iron flex-1"
            >
              Cancel
            </button>
            <SubmitButton>Permanently delete</SubmitButton>
          </div>
          <Feedback state={state} />
        </form>
      )}
    </div>
  );
}

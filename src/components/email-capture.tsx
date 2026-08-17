"use client";

import { useState, type FormEvent } from "react";

export function EmailCapture() {
  const [submitted, setSubmitted] = useState(false);
  const [email, setEmail] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim()) return;
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <p className="plate flex h-12 items-center justify-center px-6 font-mono text-sm text-verdant">
        Thanks — you&rsquo;re on the list.
      </p>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-md flex-col gap-3 sm:flex-row"
    >
      <div className="field max-w-none flex-1">
        <label htmlFor="cta-email" className="sr-only">
          Email address
        </label>
        <input
          id="cta-email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          className="h-12 px-4"
        />
      </div>
      <button type="submit" className="btn btn-forge h-12 px-6">
        Request access
      </button>
    </form>
  );
}

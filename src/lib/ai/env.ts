/**
 * Read lazily (inside functions, never at module top-level) so `next
 * build` succeeds with no `.env` file present — same reasoning as
 * src/lib/supabase/env.ts. The error only surfaces when the AI co-pilot
 * is actually invoked.
 */
export function getAnthropicEnv() {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Missing ANTHROPIC_API_KEY. Set it in .env.local (see .env.example) to use the AI co-pilot.",
    );
  }

  return { apiKey };
}

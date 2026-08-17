/**
 * Supabase env vars are read lazily (inside functions, never at module
 * top-level) so that `next build` succeeds even when no `.env` file is
 * present — for example in CI or a fresh checkout before Supabase has
 * been configured. The error only surfaces when a Supabase client is
 * actually constructed at request time.
 */
export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing Supabase environment variables. Set NEXT_PUBLIC_SUPABASE_URL " +
        "and NEXT_PUBLIC_SUPABASE_ANON_KEY (see .env.example).",
    );
  }

  return { url, anonKey };
}

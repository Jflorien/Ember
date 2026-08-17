import { cookies } from "next/headers";
import {
  createServerClient,
  type CookieMethodsServer,
} from "@supabase/ssr";
import { getSupabaseEnv } from "./env";

type CookiesToSet = Parameters<
  NonNullable<CookieMethodsServer["setAll"]>
>[0];

/**
 * Server-side Supabase client for use in Server Components, Server
 * Actions, and Route Handlers. Reads/writes the auth cookie via
 * next/headers. Throws at call time (not import time) if env vars are
 * missing so `next build` never fails on a missing `.env`.
 */
export async function createClient() {
  const { url, anonKey } = getSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
  });
}

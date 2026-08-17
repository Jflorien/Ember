import {
  createServerClient,
  type CookieMethodsServer,
} from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "./env";

type CookiesToSet = Parameters<
  NonNullable<CookieMethodsServer["setAll"]>
>[0];

const PROTECTED_PREFIXES = ["/dm", "/play", "/join"];

/**
 * Refreshes the Supabase session on every request and redirects
 * unauthenticated users away from protected routes. If Supabase env
 * vars are not configured, this is a no-op passthrough so local dev
 * without Supabase configured doesn't hard-crash the middleware.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  let url: string | undefined;
  let anonKey: string | undefined;
  try {
    ({ url, anonKey } = getSupabaseEnv());
  } catch {
    return supabaseResponse;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    request.nextUrl.pathname.startsWith(prefix),
  );

  if (!user && isProtected) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}

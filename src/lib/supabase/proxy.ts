import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getAuthCookieOptions, getSupabasePublicEnv } from "./env";

/** Pages for signed-out visitors only; signed-in users are sent to the board. */
const SIGNED_OUT_ONLY_PATHS = ["/login"];
/** Reachable with or without a session (e.g. links in Auth emails). */
const OPEN_PATHS = ["/auth/confirm"];

const matches = (paths: string[], pathname: string) =>
  paths.some((path) => pathname === path || pathname.startsWith(`${path}/`));

/**
 * Runs on every matched request:
 *   1. Refreshes the Supabase session and writes updated cookies.
 *   2. Redirects signed-out visitors to /login and signed-in users away from it.
 *
 * This is an optimistic check for fast redirects. The app layout re-verifies
 * the user on the server, and row level security protects the data itself.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const { url, publishableKey } = getSupabasePublicEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, publishableKey, {
    cookieOptions: getAuthCookieOptions(),
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        // Prevent CDNs from caching responses that carry session cookies.
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      },
    },
  });

  // Do not run code between createServerClient and getClaims(): getClaims()
  // validates the JWT and triggers the token refresh that keeps users signed in.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);
  const { pathname, search } = request.nextUrl;

  const redirectTo = (path: string, params?: Record<string, string>) => {
    const target = request.nextUrl.clone();
    target.pathname = path;
    target.search = "";
    for (const [key, value] of Object.entries(params ?? {})) target.searchParams.set(key, value);
    const redirect = NextResponse.redirect(target);
    // Carry over any refreshed session cookies and no-cache headers.
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() !== "location") redirect.headers.set(key, value);
    });
    return redirect;
  };

  if (matches(OPEN_PATHS, pathname)) return response;

  const signedOutOnly = matches(SIGNED_OUT_ONLY_PATHS, pathname);
  if (!signedIn && !signedOutOnly) {
    const next = pathname === "/" ? undefined : `${pathname}${search}`;
    return redirectTo("/login", next ? { next } : undefined);
  }

  if (signedIn && signedOutOnly) {
    return redirectTo("/board");
  }

  return response;
}

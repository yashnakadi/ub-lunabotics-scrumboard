/**
 * Public Supabase configuration. These two values are safe to ship to the
 * browser: the publishable key only grants what row level security allows.
 *
 * `process.env.NEXT_PUBLIC_*` must be referenced literally so Next.js can
 * inline the values into the client bundle.
 */
/**
 * Attributes for the Supabase session cookies. @supabase/ssr defaults to
 * `SameSite=Lax; Path=/` but does not set `Secure`, which would let a session
 * cookie travel over plain HTTP. These cookies cannot be HttpOnly: the browser
 * client must read them (that is how Supabase SSR works), so XSS defense
 * relies on React's escaping and the Content-Security-Policy in next.config.ts.
 */
export function getAuthCookieOptions(): { secure: boolean; sameSite: "lax"; path: string } {
  const secure =
    typeof window !== "undefined"
      ? window.location.protocol === "https:"
      : process.env.NODE_ENV === "production";
  return { secure, sameSite: "lax", path: "/" };
}

export function getSupabasePublicEnv(): { url: string; publishableKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local.",
    );
  }
  return { url, publishableKey };
}

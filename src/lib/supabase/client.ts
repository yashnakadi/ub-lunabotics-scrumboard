"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getAuthCookieOptions, getSupabasePublicEnv } from "./env";

let browserClient: SupabaseClient | undefined;

/**
 * Supabase client for Client Components. Uses the publishable key plus the
 * signed-in user's session cookie, so every query runs under row level
 * security as that user.
 */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (!browserClient) {
    const { url, publishableKey } = getSupabasePublicEnv();
    browserClient = createBrowserClient(url, publishableKey, {
      cookieOptions: getAuthCookieOptions(),
    });
  }
  return browserClient;
}

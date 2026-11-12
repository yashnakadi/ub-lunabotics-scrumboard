import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

// Only the flows this app uses. Signup confirmation and magic-link sign-in are
// not offered, so their link types are rejected.
const ALLOWED_TYPES: EmailOtpType[] = ["invite", "recovery", "email_change"];

/**
 * Landing point for links in Supabase Auth emails (invitations and password
 * recovery). Verifies the one-time token on the server, which establishes a
 * session in cookies, then sends the user on to set their password.
 *
 * The email templates must link here; see docs/SUPABASE_SETUP.md.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const redirectTo = (path: string) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = "";
    return url;
  };
  const invalidLink = () => {
    const url = redirectTo("/login");
    url.searchParams.set("reason", "link-invalid");
    return NextResponse.redirect(url);
  };

  if (!tokenHash || !type || !ALLOWED_TYPES.includes(type)) return invalidLink();

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) {
    console.warn("[auth/confirm] Link verification failed:", error.code ?? error.status);
    return invalidLink();
  }

  const next = type === "invite" || type === "recovery" ? "/account/password" : "/board";
  const url = redirectTo(next);
  if (type === "invite") url.searchParams.set("welcome", "1");
  return NextResponse.redirect(url);
}

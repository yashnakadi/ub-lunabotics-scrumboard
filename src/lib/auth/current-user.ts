import "server-only";

import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { TEAM_IDS } from "@/lib/constants";
import { getInitials } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Role, TeamId, User } from "@/types";

export interface SignedInUser extends User {
  /** The signed-in user's own email (never other people's). */
  email: string;
}

export type CurrentUserResult =
  | { status: "ok"; user: SignedInUser }
  /** Signed in to Supabase Auth, but no profile row exists for the account. */
  | { status: "no-profile"; email: string | null }
  /** The database could not be reached or returned an error. */
  | { status: "error" };

/**
 * Resolves the signed-in user from the session cookie, verified against
 * Supabase Auth, together with their profile and team memberships.
 *
 * Redirects to /login when there is no valid session. Role and teams always
 * come from the database (under RLS), never from anything the client sends.
 */
export async function getCurrentUser(): Promise<CurrentUserResult> {
  // Session checks are always request-time work: they must never be part of
  // a prerender, a static shell, or any shared cache. This also covers
  // auth-js reading the clock (Date.now()) to decide whether to refresh the
  // access token, which is what Cache Components flagged during prerendering.
  await connection();

  const supabase = await createSupabaseServerClient();

  // getUser() asks the Auth server to validate the token, so a revoked or
  // expired session cannot be replayed from a stale cookie.
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError && (isAuthRetryableFetchError(authError) || (authError.status ?? 0) >= 500)) {
    // Supabase Auth is unreachable. Don't treat that as a signed-out user.
    console.error("[auth] Could not verify session:", authError.status ?? "network error");
    return { status: "error" };
  }
  if (authError || !auth.user) {
    redirect("/login?reason=session");
  }
  const authUser = auth.user;

  const [profileResult, teamsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, role")
      .eq("id", authUser.id)
      .maybeSingle(),
    supabase.from("team_members").select("team_id").eq("user_id", authUser.id),
  ]);

  if (profileResult.error || teamsResult.error) {
    console.error("[auth] Failed to load profile", profileResult.error ?? teamsResult.error);
    return { status: "error" };
  }
  if (!profileResult.data) {
    return { status: "no-profile", email: authUser.email ?? null };
  }

  const profile = profileResult.data as { id: string; full_name: string; role: Role };
  const teamIds = (teamsResult.data ?? [])
    .map((row) => row.team_id as TeamId)
    .filter((id) => TEAM_IDS.includes(id))
    .sort((a, b) => TEAM_IDS.indexOf(a) - TEAM_IDS.indexOf(b));
  const email = authUser.email ?? "";
  const name = profile.full_name.trim() || email.split("@")[0] || "Member";

  return {
    status: "ok",
    user: {
      id: profile.id,
      email,
      name,
      role: profile.role === "admin" ? "admin" : "member",
      teamIds,
      initials: getInitials(name) || "?",
    },
  };
}

"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { checkRateLimit, recordAttempt, resetRateLimit, type RateLimitRule } from "@/lib/auth/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface LoginState {
  error?: string;
  fieldErrors?: { email?: string; password?: string };
  /** Echoed back so the field keeps its value after a failed attempt. */
  email?: string;
}

// Deliberately loose: Supabase Auth is the authority on what a valid address is.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVALID_CREDENTIALS = "Incorrect email or password.";
/** Failed attempts take at least this long, so timing doesn't reveal whether an account exists. */
const MIN_FAILURE_MS = 700;
const MINUTE = 60_000;

function rulesFor(ip: string, email: string): RateLimitRule[] {
  return [
    // Repeated guesses against one account from one address.
    { key: `login:account-ip:${email}:${ip}`, limit: 5, windowMs: 15 * MINUTE },
    // Distributed guessing against one account. Generous, so a real user is
    // not easily locked out by someone else.
    { key: `login:account:${email}`, limit: 15, windowMs: 15 * MINUTE },
    // Spraying many accounts from one address.
    { key: `login:ip:${ip}`, limit: 25, windowMs: 15 * MINUTE },
  ];
}

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

/** Only allow redirects to paths inside this app. */
function safeNextPath(value: FormDataEntryValue | null): string {
  if (typeof value !== "string") return "/board";
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return "/board";
  if (value.startsWith("/login") || value.startsWith("/auth/")) return "/board";
  return value;
}

async function waitAtLeast(startedAt: number, ms: number) {
  const remaining = ms - (Date.now() - startedAt);
  if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
}

/**
 * Email + password sign-in through Supabase Auth.
 *
 * Runs on the server so attempts can be rate limited and the session is
 * written to cookies by @supabase/ssr. Supabase verifies the password; the app
 * never stores, hashes, or logs it. Next.js checks the Origin header on Server
 * Actions, which protects this form from cross-site submission.
 */
export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const startedAt = Date.now();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const fieldErrors: LoginState["fieldErrors"] = {};
  if (!email) fieldErrors.email = "Enter your email address.";
  else if (!EMAIL_PATTERN.test(email) || email.length > 254) fieldErrors.email = "Enter a valid email address.";
  if (!password) fieldErrors.password = "Enter your password.";
  if (fieldErrors.email || fieldErrors.password) return { fieldErrors, email };

  const ip = await clientIp();
  const rules = rulesFor(ip, email.toLowerCase());
  const limit = checkRateLimit(rules);
  if (!limit.allowed) {
    const minutes = Math.max(1, Math.ceil(limit.retryAfterSeconds / 60));
    return {
      error: `Too many login attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
      email,
    };
  }

  const fail = async (message = INVALID_CREDENTIALS): Promise<LoginState> => {
    recordAttempt(rules);
    await waitAtLeast(startedAt, MIN_FAILURE_MS);
    return { error: message, email };
  };

  if (password.length > 256) return fail();

  let error;
  try {
    const supabase = await createSupabaseServerClient();
    ({ error } = await supabase.auth.signInWithPassword({ email, password }));
  } catch (thrown) {
    console.error("[login] Auth request threw:", thrown instanceof Error ? thrown.name : "unknown");
    return fail("Unable to reach the sign-in service. Please try again later.");
  }

  if (error) {
    if (error.status === 429 || error.code === "over_request_rate_limit") {
      return fail("Too many login attempts. Please wait a few minutes and try again.");
    }
    if (!error.status || error.status >= 500) {
      console.error("[login] Auth service error:", error.status ?? "no status");
      return fail("Unable to reach the sign-in service. Please try again later.");
    }
    if (error.code !== "invalid_credentials") {
      // e.g. email_not_confirmed or user_banned. Logged (code only, never the
      // email or password) so admins can diagnose; the user sees the generic message.
      console.warn("[login] Sign-in rejected:", error.code ?? error.status);
    }
    return fail();
  }

  resetRateLimit(rules.filter((rule) => rule.key.startsWith("login:account")).map((rule) => rule.key));
  redirect(safeNextPath(formData.get("next")));
}

/**
 * Ends the session: Supabase revokes this session's refresh token on the Auth
 * server and the auth cookies are cleared. Other devices stay signed in.
 */
export async function logout(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login?reason=signed-out");
}

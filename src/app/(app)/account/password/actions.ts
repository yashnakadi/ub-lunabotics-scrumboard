"use server";

import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "@/lib/auth/password-policy";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface PasswordState {
  ok?: boolean;
  error?: string;
  fieldErrors?: { password?: string; confirm?: string };
}

/** Sets a new password for the signed-in user via Supabase Auth (which hashes it). */
export async function updatePassword(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  const fieldErrors: PasswordState["fieldErrors"] = {};
  if (password.length < MIN_PASSWORD_LENGTH) {
    fieldErrors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  } else if (password.length > MAX_PASSWORD_LENGTH) {
    fieldErrors.password = `Use ${MAX_PASSWORD_LENGTH} characters or fewer.`;
  }
  if (confirm !== password) fieldErrors.confirm = "The passwords don't match.";
  if (fieldErrors.password || fieldErrors.confirm) return { fieldErrors };

  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Your session has ended. Please log in again." };

  const { error } = await supabase.auth.updateUser({ password });
  if (!error) return { ok: true };

  switch (error.code) {
    case "same_password":
      return { fieldErrors: { password: "Choose a password you haven't used for this account." } };
    case "weak_password":
      return { fieldErrors: { password: "That password is too weak. Try a longer one with mixed characters." } };
    case "reauthentication_needed":
      return { error: "For security, log out and back in, then change your password." };
    default:
      console.error("[account/password] updateUser failed:", error.code ?? error.status);
      return { error: "Your password could not be changed. Please try again." };
  }
}

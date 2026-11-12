import type { PostgrestError } from "@supabase/supabase-js";

import {
  AuthError,
  NotFoundError,
  PermissionDeniedError,
  ServiceError,
} from "@/lib/services/types";

/**
 * Converts a Supabase/PostgREST error into one of the app's error types with a
 * message that is safe to show. Raw database details are logged to the
 * browser console in development only and are never shown in the UI.
 */
export function toServiceError(error: PostgrestError | Error | unknown): Error {
  if (
    error instanceof PermissionDeniedError ||
    error instanceof NotFoundError ||
    error instanceof AuthError ||
    error instanceof ServiceError
  ) {
    return error;
  }

  const pg = (error ?? {}) as Partial<PostgrestError> & { status?: number; message?: string };
  const code = pg.code ?? "";
  const message = pg.message ?? "";

  if (process.env.NODE_ENV !== "production") {
    console.error("[supabase]", code || "", message || error);
  }

  // Expired or invalid JWT.
  if (code === "PGRST301" || code === "PGRST303" || pg.status === 401 || /jwt/i.test(message)) {
    return new AuthError();
  }
  // RLS rejection, missing privilege, or a guard trigger.
  if (code === "42501" || /row-level security|permission denied/i.test(message)) {
    return new PermissionDeniedError();
  }
  // .single() matched no rows: either gone or not visible to this user.
  if (code === "PGRST116") return new NotFoundError();
  if (code === "23505") return new ServiceError("That record already exists.");
  if (code === "23503") return new ServiceError("A related record no longer exists. Refresh and try again.");
  if (code === "23514" || code === "22P02" || code === "22001" || code === "23502") {
    return new ServiceError("Some of the values are invalid. Check the form and try again.");
  }
  // Table or function missing: the migration hasn't been applied.
  if (code === "PGRST205" || code === "PGRST202" || code === "42P01") {
    return new ServiceError("The database isn't set up yet. Ask an administrator to run the Supabase migration.");
  }
  if (error instanceof TypeError || /fetch|network/i.test(message)) {
    return new ServiceError("Unable to reach the database. Check your connection and try again.");
  }
  return new ServiceError("Something went wrong while talking to the database. Please try again.");
}

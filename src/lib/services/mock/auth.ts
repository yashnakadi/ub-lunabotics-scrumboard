/**
 * MOCK AUTHENTICATION — PROTOTYPE ONLY.
 *
 * This simulates sign-in against a fixed list of fictional demo accounts so
 * the role-based UI can be exercised. It is not security:
 *   - There is no real password handling. Every demo account shares one
 *     publicly displayed demo password.
 *   - The "session" is just a demo user ID kept in browser storage.
 *
 * Replace this whole file with calls to a real, server-side auth provider
 * (which must also enforce the rules in `@/lib/permissions` on the server).
 */

import { USERS } from "@/lib/data/seed";
import { AuthError, type AuthService } from "@/lib/services/types";
import type { User } from "@/types";

import { db, getSessionUser } from "./db";

/** Shared password for the fictional demo accounts. Not a real credential. */
export const DEMO_PASSWORD = "lunabotics-demo";

/** Fictional test accounts, shown on the login screen for convenience. */
export const DEMO_ACCOUNTS: User[] = USERS;

export const mockAuthService: AuthService = {
  async signIn(email, password) {
    const normalized = email.trim().toLowerCase();
    const user = USERS.find((u) => u.email.toLowerCase() === normalized);
    if (!user || password !== DEMO_PASSWORD) {
      // Same message for both cases so the form doesn't reveal which emails exist.
      throw new AuthError("Incorrect email or password.");
    }
    db.setSessionUserId(user.id);
    return user;
  },

  async signOut() {
    db.setSessionUserId(null);
  },

  async getCurrentUser() {
    return getSessionUser();
  },
};

/** Demo-only helper: restores the original mock tasks and inventory. */
export function resetDemoData(): void {
  db.reset();
}

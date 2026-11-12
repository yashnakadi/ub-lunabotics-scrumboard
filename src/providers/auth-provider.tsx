"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, type ReactNode } from "react";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { User } from "@/types";

/** The signed-in user, including their own email address. */
export interface SignedInUser extends User {
  email: string;
}

const AuthContext = createContext<SignedInUser | null>(null);

/**
 * Makes the server-verified user available to Client Components and watches
 * for the session ending (sign-out in another tab, or an expired refresh
 * token), in which case it sends the user back to the login page.
 *
 * The user object is display data only. Every permission is enforced again by
 * the database through row level security.
 */
export function AuthProvider({ user, children }: { user: SignedInUser; children: ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || (session && session.user.id !== user.id)) {
        router.replace("/login?reason=session");
        router.refresh();
      }
    });
    return () => data.subscription.unsubscribe();
  }, [router, user.id]);

  return <AuthContext.Provider value={user}>{children}</AuthContext.Provider>;
}

/** The signed-in user. Only call from components rendered inside the app shell. */
export function useCurrentUser(): SignedInUser {
  const user = useContext(AuthContext);
  if (!user) throw new Error("useCurrentUser must be used inside <AuthProvider>.");
  return user;
}

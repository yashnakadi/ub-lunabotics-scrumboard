"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { services } from "@/lib/services";
import type { User } from "@/types";

type AuthState =
  | { status: "loading"; user: null }
  | { status: "unauthenticated"; user: null }
  | { status: "authenticated"; user: User };

interface AuthContextValue {
  status: AuthState["status"];
  user: User | null;
  signIn: (email: string, password: string) => Promise<User>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading", user: null });

  useEffect(() => {
    let cancelled = false;
    services.auth
      .getCurrentUser()
      .catch(() => null)
      .then((user) => {
        if (cancelled) return;
        setState(
          user
            ? { status: "authenticated", user }
            : { status: "unauthenticated", user: null },
        );
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const user = await services.auth.signIn(email, password);
    setState({ status: "authenticated", user });
    return user;
  }, []);

  const signOut = useCallback(async () => {
    await services.auth.signOut();
    setState({ status: "unauthenticated", user: null });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ status: state.status, user: state.user, signIn, signOut }),
    [state, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>.");
  return context;
}

/** The signed-in user. Only call from components rendered inside the app shell. */
export function useCurrentUser(): User {
  const { user } = useAuth();
  if (!user) throw new Error("useCurrentUser requires a signed-in user.");
  return user;
}

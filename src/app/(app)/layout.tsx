import { Suspense, type ReactNode } from "react";

import { AccountProblem } from "@/components/auth/account-problem";
import { AppShell } from "@/components/layout/app-shell";
import { FullScreenLoader } from "@/components/layout/loader";
import { getCurrentUser } from "@/lib/auth/current-user";
import { AuthProvider } from "@/providers/auth-provider";

export default function AppLayout({ children }: { children: ReactNode }) {
  // The session is request data, so it is read inside a Suspense boundary.
  return (
    <Suspense fallback={<FullScreenLoader />}>
      <AuthenticatedApp>{children}</AuthenticatedApp>
    </Suspense>
  );
}

/** Verifies the session on the server before any signed-in page renders. */
async function AuthenticatedApp({ children }: { children: ReactNode }) {
  const result = await getCurrentUser();

  if (result.status === "no-profile") {
    return (
      <AccountProblem
        title="Your account isn't set up yet"
        description="You're signed in, but no team profile exists for this account. Ask a team administrator to finish setting it up."
      />
    );
  }
  if (result.status === "error") {
    return (
      <AccountProblem
        title="We couldn't load your account"
        description="The database could not be reached. Check your connection and try again in a moment."
        retry
      />
    );
  }

  return (
    <AuthProvider user={result.user}>
      <AppShell>{children}</AppShell>
    </AuthProvider>
  );
}

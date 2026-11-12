import type { Metadata } from "next";

import { PasswordView } from "@/components/auth/password-view";

export const metadata: Metadata = { title: "Change password" };

/** Signed-in pages depend on the session, so they cannot be prerendered. */
export const instant = false;

export default function Page() {
  return <PasswordView />;
}

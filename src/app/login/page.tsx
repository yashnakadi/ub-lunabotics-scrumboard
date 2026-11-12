import type { Metadata } from "next";
import { Suspense } from "react";

import { LoginView } from "@/components/auth/login-view";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
  // LoginView reads ?next= and ?reason= from the URL, which is request data.
  return (
    <Suspense>
      <LoginView />
    </Suspense>
  );
}

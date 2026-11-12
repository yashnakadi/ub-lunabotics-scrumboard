"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { FullScreenLoader } from "@/components/layout/loader";
import { useAuth } from "@/providers/auth-provider";

/** Sends visitors to the board when signed in, otherwise to the login page. */
export function HomeRedirect() {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") router.replace("/board");
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  return <FullScreenLoader />;
}

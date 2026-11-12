import type { Metadata } from "next";

import { DashboardView } from "@/components/dashboard/dashboard-view";

export const metadata: Metadata = { title: "Dashboard" };

/**
 * This page renders only after the client-side (mock) session check, so it is
 * not part of the prerendered shell. Revisit once sessions resolve on the server.
 */
export const instant = false;

export default function Page() {
  return <DashboardView />;
}

import type { Metadata } from "next";

import { InventoryView } from "@/components/inventory/inventory-view";

export const metadata: Metadata = { title: "Inventory" };

/**
 * This page renders only after the client-side (mock) session check, so it is
 * not part of the prerendered shell. Revisit once sessions resolve on the server.
 */
export const instant = false;

export default function Page() {
  return <InventoryView />;
}

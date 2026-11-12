import type { Metadata } from "next";

import { InventoryView } from "@/components/inventory/inventory-view";

export const metadata: Metadata = { title: "Inventory" };

/**
 * Signed-in pages depend on the session (read per request in the (app) layout),
 * so they cannot be prerendered into a static shell.
 */
export const instant = false;

export default function Page() {
  return <InventoryView />;
}

/** Pure helpers for inventory records. */

import type { InventoryCondition, InventoryItem } from "@/types";

/** Low stock when quantity is at or below the item's threshold (0 disables it). */
export function isLowStock(item: Pick<InventoryItem, "quantity" | "lowStockThreshold">): boolean {
  return item.lowStockThreshold > 0 && item.quantity <= item.lowStockThreshold;
}

export function needsAttention(condition: InventoryCondition): boolean {
  return condition === "Needs Repair" || condition === "Out of Service";
}

export function summarizeInventory(items: InventoryItem[]) {
  return {
    entries: items.length,
    units: items.reduce((sum, item) => sum + item.quantity, 0),
    lowStock: items.filter(isLowStock).length,
    needsAttention: items.filter((item) => needsAttention(item.condition)).length,
  };
}

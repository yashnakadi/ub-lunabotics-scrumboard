/** Mock inventory service backed by browser storage. Writes are admin-only. */

import { canManageInventory } from "@/lib/permissions";
import {
  NotFoundError,
  PermissionDeniedError,
  type InventoryService,
} from "@/lib/services/types";
import type { InventoryItem } from "@/types";

import { db, requireSessionUser } from "./db";

function requireManager(): void {
  if (!canManageInventory(requireSessionUser())) throw new PermissionDeniedError();
}

function nextId(items: InventoryItem[]): string {
  const highest = items.reduce(
    (max, item) => Math.max(max, Number(item.id.split("-")[1]) || 0),
    0,
  );
  return `INV-${String(highest + 1).padStart(4, "0")}`;
}

export const mockInventoryService: InventoryService = {
  async list() {
    requireSessionUser();
    return db.getInventory();
  },

  async create(input) {
    requireManager();
    const items = db.getInventory();
    const item: InventoryItem = {
      ...input,
      id: nextId(items),
      updatedAt: new Date().toISOString(),
    };
    db.setInventory([...items, item]);
    return item;
  },

  async update(id, patch) {
    requireManager();
    const items = db.getInventory();
    const index = items.findIndex((item) => item.id === id);
    if (index === -1) throw new NotFoundError();
    const updated: InventoryItem = {
      ...items[index],
      ...patch,
      id,
      updatedAt: new Date().toISOString(),
    };
    items[index] = updated;
    db.setInventory(items);
    return updated;
  },

  async remove(id) {
    requireManager();
    const items = db.getInventory();
    if (!items.some((item) => item.id === id)) throw new NotFoundError();
    db.setInventory(items.filter((item) => item.id !== id));
  },
};

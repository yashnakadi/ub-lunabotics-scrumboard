import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { InventoryService } from "@/lib/services/types";

import { toServiceError } from "./errors";
import {
  INVENTORY_SELECT,
  mapInventoryItem,
  toInventoryRow,
  type InventoryRow,
} from "./mappers";
import { PermissionDeniedError } from "@/lib/services/types";

/** Inventory data access. Readable by everyone signed in; writes are admin-only (RLS). */

const db = () => getSupabaseBrowserClient();

export const supabaseInventoryService: InventoryService = {
  async list() {
    const { data, error } = await db().from("inventory").select(INVENTORY_SELECT).order("item_name");
    if (error) throw toServiceError(error);
    return ((data ?? []) as InventoryRow[]).map(mapInventoryItem);
  },

  async create(input) {
    const { data, error } = await db()
      .from("inventory")
      .insert(toInventoryRow(input))
      .select(INVENTORY_SELECT)
      .single();
    if (error) throw toServiceError(error);
    return mapInventoryItem(data as InventoryRow);
  },

  async update(id, patch) {
    const { data, error } = await db()
      .from("inventory")
      .update(toInventoryRow(patch))
      .eq("id", id)
      .select(INVENTORY_SELECT)
      .maybeSingle();
    if (error) throw toServiceError(error);
    // RLS filtered the row out: the caller may not edit inventory.
    if (!data) throw new PermissionDeniedError();
    return mapInventoryItem(data as InventoryRow);
  },

  async remove(id) {
    const { data, error } = await db().from("inventory").delete().eq("id", id).select("id");
    if (error) throw toServiceError(error);
    if (!data || data.length === 0) throw new PermissionDeniedError();
  },
};

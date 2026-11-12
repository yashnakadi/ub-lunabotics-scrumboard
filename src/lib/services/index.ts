/**
 * The single place where the app chooses its data source.
 *
 * All implementations query Supabase as the signed-in user, so PostgreSQL row
 * level security enforces the Admin/Member rules on every request.
 */

import { supabaseDirectoryService } from "./supabase/directory";
import { supabaseInventoryService } from "./supabase/inventory";
import { supabaseTaskService } from "./supabase/tasks";
import type { Services } from "./types";

export const services: Services = {
  directory: supabaseDirectoryService,
  tasks: supabaseTaskService,
  inventory: supabaseInventoryService,
};

export * from "./types";

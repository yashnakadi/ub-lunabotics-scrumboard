/**
 * The single place where the app chooses its data source.
 *
 * To move from mock data to a real backend, implement the interfaces in
 * `./types.ts` and replace the assignments below. No component imports from
 * `./mock` directly (the login screen's demo-account helper is the one
 * deliberate, clearly labeled exception).
 */

import { mockAuthService } from "./mock/auth";
import { mockDirectoryService } from "./mock/directory";
import { mockInventoryService } from "./mock/inventory";
import { mockTaskService } from "./mock/tasks";
import type { Services } from "./types";

export const services: Services = {
  auth: mockAuthService,
  directory: mockDirectoryService,
  tasks: mockTaskService,
  inventory: mockInventoryService,
};

export * from "./types";

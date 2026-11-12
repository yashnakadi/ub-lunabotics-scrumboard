/** Mock directory of members and teams. Read-only in the prototype. */

import { TEAMS, USERS } from "@/lib/data/seed";
import type { DirectoryService } from "@/lib/services/types";

import { requireSessionUser } from "./db";

export const mockDirectoryService: DirectoryService = {
  async listUsers() {
    requireSessionUser();
    return USERS;
  },

  async listTeams() {
    requireSessionUser();
    return TEAMS;
  },
};

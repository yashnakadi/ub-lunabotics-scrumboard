/**
 * Browser-backed stand-in for a database.
 *
 * Tasks and inventory are kept in localStorage so prototype edits survive a
 * page refresh. This is per-browser demo storage, not shared or permanent.
 * Nothing sensitive is written here: the "session" is only the ID of a
 * fictional demo account, and no passwords are ever stored.
 */

import { buildSeedInventory, buildSeedTasks, USERS } from "@/lib/data/seed";
import { AuthError } from "@/lib/services/types";
import type { InventoryItem, Task, User } from "@/types";

const VERSION = "v1";
const KEYS = {
  tasks: `ubl:${VERSION}:tasks`,
  inventory: `ubl:${VERSION}:inventory`,
  session: `ubl:${VERSION}:session`,
} as const;

/** Fallback used when localStorage is unavailable (SSR, private mode, etc.). */
const memory = new Map<string, string>();

function read(key: string): string | null {
  try {
    if (typeof window !== "undefined") return window.localStorage.getItem(key);
  } catch {
    // fall through to memory
  }
  return memory.get(key) ?? null;
}

function write(key: string, value: string | null): void {
  if (value === null) memory.delete(key);
  else memory.set(key, value);
  try {
    if (typeof window === "undefined") return;
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Storage full or blocked: the in-memory copy keeps the session usable.
  }
}

function load<T>(key: string, seed: () => T): T {
  const raw = read(key);
  if (raw) {
    try {
      return JSON.parse(raw) as T;
    } catch {
      // Corrupt entry: fall back to fresh seed data.
    }
  }
  const fresh = seed();
  write(key, JSON.stringify(fresh));
  return fresh;
}

export const db = {
  getTasks: (): Task[] => load(KEYS.tasks, buildSeedTasks),
  setTasks: (tasks: Task[]) => write(KEYS.tasks, JSON.stringify(tasks)),

  getInventory: (): InventoryItem[] => load(KEYS.inventory, buildSeedInventory),
  setInventory: (items: InventoryItem[]) =>
    write(KEYS.inventory, JSON.stringify(items)),

  getUsers: (): User[] => USERS,

  getSessionUserId: (): string | null => read(KEYS.session),
  setSessionUserId: (userId: string | null) => write(KEYS.session, userId),

  /** Restores the original demo tasks and inventory. */
  reset: () => {
    write(KEYS.tasks, null);
    write(KEYS.inventory, null);
  },
};

/** The mock equivalent of reading the authenticated user from a server session. */
export function getSessionUser(): User | null {
  const id = db.getSessionUserId();
  if (!id) return null;
  return USERS.find((user) => user.id === id) ?? null;
}

export function requireSessionUser(): User {
  const user = getSessionUser();
  if (!user) throw new AuthError("Your session has ended. Please sign in again.");
  return user;
}

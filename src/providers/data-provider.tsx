"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";

import { STATUS_LABELS } from "@/lib/constants";
import {
  AuthError,
  services,
  type InventoryInput,
  type TaskInput,
  type TaskPatch,
} from "@/lib/services";
import type { InventoryItem, Task, TaskStatus, Team, TeamId, User } from "@/types";

interface DataContextValue {
  loading: boolean;
  /** Set when the initial load failed. Pages show an error instead of data. */
  loadError: string | null;
  /** Re-fetches everything from the database. */
  reload: () => Promise<void>;
  users: User[];
  teams: Team[];
  tasks: Task[];
  inventory: InventoryItem[];
  getUser: (id: string | null) => User | undefined;
  getTeam: (id: TeamId) => Team | undefined;

  createTask: (input: TaskInput) => Promise<Task | undefined>;
  updateTask: (id: string, patch: TaskPatch, successMessage?: string) => Promise<Task | undefined>;
  moveTask: (id: string, status: TaskStatus, order?: number) => Promise<void>;
  deleteTask: (id: string) => Promise<boolean>;
  addChecklistItem: (id: string, label: string) => Promise<void>;
  toggleChecklistItem: (id: string, itemId: string, done: boolean) => Promise<void>;
  removeChecklistItem: (id: string, itemId: string) => Promise<void>;
  addComment: (id: string, body: string) => Promise<boolean>;

  createItem: (input: InventoryInput) => Promise<InventoryItem | undefined>;
  updateItem: (
    id: string,
    patch: Partial<InventoryInput>,
    successMessage?: string,
  ) => Promise<InventoryItem | undefined>;
  deleteItem: (id: string) => Promise<boolean>;
}

const DataContext = createContext<DataContextValue | null>(null);

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

interface Snapshot {
  users: User[];
  teams: Team[];
  tasks: Task[];
  inventory: InventoryItem[];
}

async function fetchSnapshot(): Promise<Snapshot> {
  const [users, teams, tasks, inventory] = await Promise.all([
    services.directory.listUsers(),
    services.directory.listTeams(),
    services.tasks.list(),
    services.inventory.list(),
  ]);
  return { users, teams, tasks, inventory };
}

/** Refetch when the tab regains focus, at most this often. */
const FOCUS_REFRESH_MS = 30_000;

/**
 * Holds the records the signed-in user is allowed to see and exposes the
 * actions pages use. Everything comes from Supabase through `services`; there
 * is no placeholder or cached fallback data.
 */
export function DataProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);

  const applySnapshot = useCallback((snapshot: Snapshot) => {
    setUsers(snapshot.users);
    setTeams(snapshot.teams);
    setTasks(snapshot.tasks);
    setInventory(snapshot.inventory);
  }, []);

  /** An expired session sends the user back to the login page. */
  const handleAuthFailure = useCallback(
    (error: unknown): boolean => {
      if (!(error instanceof AuthError)) return false;
      toast.error(error.message);
      router.replace("/login?reason=session");
      router.refresh();
      return true;
    },
    [router],
  );

  const lastLoadedAt = useRef(0);

  /**
   * Re-fetches everything. Only an explicit retry from the error screen
   * replaces the page with an error; background refreshes fail quietly and
   * keep showing the last data that loaded successfully.
   */
  const refresh = useCallback(
    async ({ showErrorPage = false }: { showErrorPage?: boolean } = {}) => {
      try {
        applySnapshot(await fetchSnapshot());
        lastLoadedAt.current = Date.now();
        setLoadError(null);
      } catch (error) {
        if (!handleAuthFailure(error) && showErrorPage) setLoadError(errorMessage(error));
      }
    },
    [applySnapshot, handleAuthFailure],
  );

  const reload = useCallback(() => refresh({ showErrorPage: true }), [refresh]);

  useEffect(() => {
    let cancelled = false;
    fetchSnapshot()
      .then((snapshot) => {
        if (cancelled) return;
        applySnapshot(snapshot);
        lastLoadedAt.current = Date.now();
      })
      .catch((error) => {
        if (!cancelled && !handleAuthFailure(error)) setLoadError(errorMessage(error));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [applySnapshot, handleAuthFailure]);

  // Pick up teammates' changes when returning to the tab.
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastLoadedAt.current < FOCUS_REFRESH_MS) return;
      void refresh();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);

  /** Runs a write. On failure, shows the error and re-syncs from the database. */
  const attempt = useCallback(
    async <T,>(action: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false }> => {
      try {
        return { ok: true, value: await action() };
      } catch (error) {
        if (!handleAuthFailure(error)) {
          toast.error(errorMessage(error));
          // Re-sync so optimistic changes and stale rows are corrected.
          await refresh();
        }
        return { ok: false };
      }
    },
    [refresh, handleAuthFailure],
  );

  const putTask = useCallback((task: Task) => {
    setTasks((prev) =>
      prev.some((t) => t.id === task.id)
        ? prev.map((t) => (t.id === task.id ? task : t))
        : [...prev, task],
    );
  }, []);

  const putItem = useCallback((item: InventoryItem) => {
    setInventory((prev) =>
      prev.some((i) => i.id === item.id)
        ? prev.map((i) => (i.id === item.id ? item : i))
        : [...prev, item],
    );
  }, []);

  const value = useMemo<DataContextValue>(() => {
    const userById = new Map(users.map((user) => [user.id, user]));
    const teamById = new Map(teams.map((team) => [team.id, team]));

    return {
      loading,
      loadError,
      reload,
      users,
      teams,
      tasks,
      inventory,
      getUser: (id) => (id ? userById.get(id) : undefined),
      getTeam: (id) => teamById.get(id),

      async createTask(input) {
        const result = await attempt(() => services.tasks.create(input));
        if (!result.ok) return undefined;
        putTask(result.value);
        toast.success(`Created ${result.value.key}`);
        return result.value;
      },

      async updateTask(id, patch, successMessage = "Task updated") {
        const result = await attempt(() => services.tasks.update(id, patch));
        if (!result.ok) return undefined;
        putTask(result.value);
        toast.success(successMessage);
        return result.value;
      },

      async moveTask(id, status, order) {
        const before = tasks.find((task) => task.id === id);
        if (!before) return;
        // Optimistic update keeps drag-and-drop feeling instant.
        setTasks((prev) =>
          prev.map((task) =>
            task.id === id ? { ...task, status, order: order ?? task.order } : task,
          ),
        );
        const result = await attempt(() => services.tasks.move(id, status, order));
        if (!result.ok) return;
        putTask(result.value);
        if (before.status !== status) {
          toast.success(`${before.key} moved to ${STATUS_LABELS[status]}`);
        }
      },

      async deleteTask(id) {
        const target = tasks.find((task) => task.id === id);
        const result = await attempt(() => services.tasks.remove(id));
        if (!result.ok) return false;
        setTasks((prev) => prev.filter((task) => task.id !== id));
        toast.success(`Deleted ${target?.key ?? "task"}`);
        return true;
      },

      async addChecklistItem(id, label) {
        const result = await attempt(() => services.tasks.addChecklistItem(id, label));
        if (result.ok) putTask(result.value);
      },

      async toggleChecklistItem(id, itemId, done) {
        const result = await attempt(() =>
          services.tasks.toggleChecklistItem(id, itemId, done),
        );
        if (result.ok) putTask(result.value);
      },

      async removeChecklistItem(id, itemId) {
        const result = await attempt(() => services.tasks.removeChecklistItem(id, itemId));
        if (result.ok) putTask(result.value);
      },

      async addComment(id, body) {
        const result = await attempt(() => services.tasks.addComment(id, body));
        if (!result.ok) return false;
        putTask(result.value);
        toast.success("Comment added");
        return true;
      },

      async createItem(input) {
        const result = await attempt(() => services.inventory.create(input));
        if (!result.ok) return undefined;
        putItem(result.value);
        toast.success(`Added ${result.value.name}`);
        return result.value;
      },

      async updateItem(id, patch, successMessage = "Item updated") {
        const result = await attempt(() => services.inventory.update(id, patch));
        if (!result.ok) return undefined;
        putItem(result.value);
        toast.success(successMessage);
        return result.value;
      },

      async deleteItem(id) {
        const target = inventory.find((item) => item.id === id);
        const result = await attempt(() => services.inventory.remove(id));
        if (!result.ok) return false;
        setInventory((prev) => prev.filter((item) => item.id !== id));
        toast.success(`Deleted ${target?.name ?? "item"}`);
        return true;
      },
    };
  }, [loading, loadError, reload, users, teams, tasks, inventory, attempt, putTask, putItem]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const context = useContext(DataContext);
  if (!context) throw new Error("useData must be used inside <DataProvider>.");
  return context;
}

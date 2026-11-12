/**
 * Data-access contracts.
 *
 * The UI talks only to these interfaces (through `@/lib/services`). The
 * implementations in `./supabase` query Supabase as the signed-in user, so
 * PostgreSQL row level security authorizes every read and write.
 *
 * Every method is async and takes no "acting user" argument: the database
 * identifies the caller from the session. Sign-in and sign-out are handled by
 * server actions in `src/app/login/actions.ts`, not by these services.
 */

import type {
  InventoryItem,
  Task,
  TaskPriority,
  TaskStatus,
  Team,
  TeamId,
  User,
} from "@/types";

/** Thrown when the signed-in user is not allowed to perform an action. */
export class PermissionDeniedError extends Error {
  constructor(message = "You don't have permission to do that.") {
    super(message);
    this.name = "PermissionDeniedError";
  }
}

/** Thrown when the session is missing or has expired. */
export class AuthError extends Error {
  constructor(message = "Your session has expired. Please log in again.") {
    super(message);
    this.name = "AuthError";
  }
}

export class NotFoundError extends Error {
  constructor(message = "That record no longer exists.") {
    super(message);
    this.name = "NotFoundError";
  }
}

/** Thrown for any other failure. The message is always safe to show users. */
export class ServiceError extends Error {
  constructor(message = "Something went wrong. Please try again.") {
    super(message);
    this.name = "ServiceError";
  }
}

export interface DirectoryService {
  listUsers(): Promise<User[]>;
  listTeams(): Promise<Team[]>;
}

/** Fields an admin supplies when creating a task. */
export interface TaskInput {
  title: string;
  description: string;
  teamId: TeamId;
  assigneeId: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  tags: string[];
  /** Labels for the initial checklist. */
  checklist: string[];
}

/** Admin-only fields that can be changed on an existing task. */
export type TaskPatch = Partial<
  Pick<
    TaskInput,
    "title" | "description" | "teamId" | "assigneeId" | "priority" | "dueDate" | "tags"
  >
>;

export interface TaskService {
  /** Returns only the tasks the current user is allowed to see. */
  list(): Promise<Task[]>;
  get(id: string): Promise<Task>;
  create(input: TaskInput): Promise<Task>;
  update(id: string, patch: TaskPatch): Promise<Task>;
  /**
   * Changes status and/or position in the column. Allowed for admins and for
   * the task's assignee.
   */
  move(id: string, status: TaskStatus, order?: number): Promise<Task>;
  remove(id: string): Promise<void>;
  addChecklistItem(id: string, label: string): Promise<Task>;
  toggleChecklistItem(id: string, itemId: string, done: boolean): Promise<Task>;
  removeChecklistItem(id: string, itemId: string): Promise<Task>;
  addComment(id: string, body: string): Promise<Task>;
}

export type InventoryInput = Omit<InventoryItem, "id" | "itemNumber" | "code" | "updatedAt">;

export interface InventoryService {
  list(): Promise<InventoryItem[]>;
  create(input: InventoryInput): Promise<InventoryItem>;
  update(id: string, patch: Partial<InventoryInput>): Promise<InventoryItem>;
  remove(id: string): Promise<void>;
}

export interface Services {
  directory: DirectoryService;
  tasks: TaskService;
  inventory: InventoryService;
}

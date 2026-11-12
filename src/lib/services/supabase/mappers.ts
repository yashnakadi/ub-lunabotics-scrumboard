/**
 * Row <-> domain mapping. Column names live here and in the select strings;
 * the rest of the app only sees the types in `@/types`.
 */

import type {
  InventoryCategory,
  InventoryCondition,
  InventoryItem,
  Role,
  Task,
  TaskActivity,
  TaskActivityAction,
  TaskPriority,
  TaskStatus,
  Team,
  TeamId,
  User,
} from "@/types";
import { getInitials } from "@/lib/format";

/* --------------------------------- Teams --------------------------------- */

export const TEAM_SELECT = "id, name, task_prefix";

export interface TeamRow {
  id: string;
  name: string;
  task_prefix: string;
}

export function mapTeam(row: TeamRow): Team {
  return { id: row.id as TeamId, name: row.name, prefix: row.task_prefix };
}

/* --------------------------------- Users --------------------------------- */

// Minimal columns. Email is intentionally absent: end users have no
// privilege to read other people's email addresses.
export const PROFILE_SELECT = "id, full_name, role";

export interface ProfileRow {
  id: string;
  full_name: string;
  role: Role;
}

export function mapUser(row: ProfileRow, teamIds: TeamId[]): User {
  const name = row.full_name?.trim() || "Unnamed member";
  return {
    id: row.id,
    name,
    role: row.role === "admin" ? "admin" : "member",
    teamIds,
    initials: getInitials(name) || "?",
  };
}

/* --------------------------------- Tasks --------------------------------- */

export const TASK_SELECT = `
  id, task_number, title, description, team_id, assigned_to, created_by,
  status, priority, due_date, tags, sort_order, created_at, updated_at,
  team:teams ( task_prefix ),
  checklist:task_checklist_items ( id, content, is_completed, sort_order, created_at ),
  comments:task_comments ( id, author_id, content, created_at ),
  activity:task_activity ( id, actor_id, action, details, created_at )
`;

export interface TaskRow {
  id: string;
  task_number: number;
  title: string;
  description: string;
  team_id: string;
  assigned_to: string | null;
  created_by: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  tags: string[] | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  team: { task_prefix: string } | null;
  checklist: { id: string; content: string; is_completed: boolean; sort_order: number; created_at: string }[] | null;
  comments: { id: string; author_id: string | null; content: string; created_at: string }[] | null;
  activity: {
    id: string;
    actor_id: string | null;
    action: TaskActivityAction;
    details: Record<string, unknown> | null;
    created_at: string;
  }[] | null;
}

export function formatTaskKey(prefix: string | undefined, taskNumber: number): string {
  return `${prefix ?? "T"}-${String(taskNumber).padStart(3, "0")}`;
}

function stringifyDetails(details: Record<string, unknown> | null): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const [key, value] of Object.entries(details ?? {})) {
    out[key] = value === null || value === undefined ? null : String(value);
  }
  return out;
}

export function mapTask(row: TaskRow): Task {
  const byCreated = <T extends { created_at: string }>(a: T, b: T) =>
    a.created_at.localeCompare(b.created_at);

  return {
    id: row.id,
    taskNumber: row.task_number,
    key: formatTaskKey(row.team?.task_prefix, row.task_number),
    title: row.title,
    description: row.description ?? "",
    status: row.status,
    priority: row.priority,
    teamId: row.team_id as TeamId,
    assigneeId: row.assigned_to,
    dueDate: row.due_date,
    createdById: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    tags: row.tags ?? [],
    order: row.sort_order,
    checklist: [...(row.checklist ?? [])]
      .sort((a, b) => a.sort_order - b.sort_order || byCreated(a, b))
      .map((item) => ({ id: item.id, label: item.content, done: item.is_completed })),
    comments: [...(row.comments ?? [])].sort(byCreated).map((c) => ({
      id: c.id,
      taskId: row.id,
      authorId: c.author_id,
      body: c.content,
      createdAt: c.created_at,
    })),
    activity: [...(row.activity ?? [])].sort(byCreated).map(
      (a): TaskActivity => ({
        id: a.id,
        taskId: row.id,
        actorId: a.actor_id,
        action: a.action,
        details: stringifyDetails(a.details),
        createdAt: a.created_at,
      }),
    ),
  };
}

/* ------------------------------- Inventory ------------------------------- */

export const INVENTORY_SELECT = `
  id, item_number, item_name, category, description, quantity, low_stock_threshold,
  storage_location, condition, team_id, image_url, notes, created_at, updated_at
`;

export interface InventoryRow {
  id: string;
  item_number: number;
  item_name: string;
  category: InventoryCategory;
  description: string;
  quantity: number;
  low_stock_threshold: number;
  storage_location: string;
  condition: InventoryCondition;
  team_id: string | null;
  image_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function formatItemCode(itemNumber: number): string {
  return `INV-${String(itemNumber).padStart(4, "0")}`;
}

export function mapInventoryItem(row: InventoryRow): InventoryItem {
  return {
    id: row.id,
    itemNumber: row.item_number,
    code: formatItemCode(row.item_number),
    name: row.item_name,
    category: row.category,
    description: row.description ?? "",
    quantity: row.quantity,
    lowStockThreshold: row.low_stock_threshold,
    location: row.storage_location,
    condition: row.condition,
    teamId: (row.team_id as TeamId | null) ?? null,
    updatedAt: row.updated_at,
    imageUrl: row.image_url ?? undefined,
    notes: row.notes ?? undefined,
  };
}

/** Domain -> row, for inserts and partial updates. */
export function toInventoryRow(
  input: Partial<Omit<InventoryItem, "id" | "itemNumber" | "code" | "updatedAt">>,
): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (input.name !== undefined) row.item_name = input.name;
  if (input.category !== undefined) row.category = input.category;
  if (input.description !== undefined) row.description = input.description;
  if (input.quantity !== undefined) row.quantity = input.quantity;
  if (input.lowStockThreshold !== undefined) row.low_stock_threshold = input.lowStockThreshold;
  if (input.location !== undefined) row.storage_location = input.location;
  if (input.condition !== undefined) row.condition = input.condition;
  if ("teamId" in input) row.team_id = input.teamId ?? null;
  if ("imageUrl" in input) row.image_url = input.imageUrl || null;
  if ("notes" in input) row.notes = input.notes || null;
  return row;
}

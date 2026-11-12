/**
 * Domain models for the UB Lunabotics project management app.
 *
 * These are the shapes the UI works with. The Supabase service layer
 * (`src/lib/services/supabase`) maps database rows to them, so components never
 * depend on table or column names.
 */

export type Role = "admin" | "member";

export type TeamId = "software" | "electrical" | "mechanical";

export interface Team {
  id: TeamId;
  name: string;
  /** Prefix used for task keys, e.g. "SW" -> SW-001. */
  prefix: string;
}

export interface User {
  id: string;
  /** Full name as set by an administrator. */
  name: string;
  role: Role;
  /**
   * Teams the user belongs to. Members can only read their own memberships,
   * so for other people this is empty unless the viewer is an admin.
   */
  teamIds: TeamId[];
  initials: string;
}

export type TaskStatus = "todo" | "in_progress" | "in_review" | "done";

export type TaskPriority = "low" | "medium" | "high" | "urgent";

export interface TaskChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

export interface TaskComment {
  id: string;
  taskId: string;
  /** Null when the author's account has been removed. */
  authorId: string | null;
  body: string;
  createdAt: string;
}

export type TaskActivityAction =
  | "created"
  | "status_changed"
  | "assignee_changed"
  | "priority_changed"
  | "due_date_changed"
  | "team_changed"
  | "details_edited";

/** History entry written by the database whenever a task changes. */
export interface TaskActivity {
  id: string;
  taskId: string;
  /** Null for changes made by an administrator directly in Supabase. */
  actorId: string | null;
  action: TaskActivityAction;
  /** Action-specific values, e.g. `{ from: "todo", to: "done" }`. */
  details: Record<string, string | null>;
  createdAt: string;
}

export interface Task {
  /** Stable internal identifier (UUID). */
  id: string;
  /** Per-team sequence number assigned by the database. */
  taskNumber: number;
  /** Human-readable key shown in the UI, e.g. SW-001. */
  key: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  teamId: TeamId;
  assigneeId: string | null;
  /** Local calendar date, formatted YYYY-MM-DD. */
  dueDate: string | null;
  /** Null when the creator's account has been removed. */
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  checklist: TaskChecklistItem[];
  comments: TaskComment[];
  activity: TaskActivity[];
  /** Sort position within its Kanban column (ascending). */
  order: number;
}

export type InventoryCategory =
  | "Computing"
  | "Electrical"
  | "Mechanical"
  | "Sensors"
  | "Tools"
  | "Miscellaneous";

export type InventoryCondition =
  | "New"
  | "Good"
  | "Fair"
  | "Needs Repair"
  | "Out of Service";

export interface InventoryItem {
  /** Stable internal identifier (UUID). */
  id: string;
  /** Sequence number assigned by the database. */
  itemNumber: number;
  /** Item ID shown in the UI, e.g. INV-0001. */
  code: string;
  name: string;
  category: InventoryCategory;
  description: string;
  quantity: number;
  /** The item is flagged as low stock when quantity <= this value. 0 disables the flag. */
  lowStockThreshold: number;
  location: string;
  condition: InventoryCondition;
  /** Owning team, or null when the item is shared by the whole organization. */
  teamId: TeamId | null;
  updatedAt: string;
  imageUrl?: string;
  notes?: string;
}

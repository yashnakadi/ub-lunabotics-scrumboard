/**
 * Domain models for the UB Lunabotics project management app.
 *
 * These are the shapes the UI works with. When a real backend is added, the
 * API/database layer should map its records to these same interfaces so the
 * components do not need to change.
 */

export type Role = "admin" | "member";

export type TeamId = "software" | "electrical" | "mechanical";

export interface Team {
  id: TeamId;
  name: string;
  /** Prefix used for task keys, e.g. "SW" -> SW-001. */
  prefix: string;
  description: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  teamIds: TeamId[];
  initials: string;
  /** Short role/position label shown in pickers, e.g. "Autonomy Lead". */
  title?: string;
  avatarUrl?: string;
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
  authorId: string;
  body: string;
  createdAt: string;
  /** "activity" entries are system-generated history (status changes, etc.). */
  kind: "comment" | "activity";
}

export interface Task {
  /** Stable internal identifier. */
  id: string;
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
  createdById: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  checklist: TaskChecklistItem[];
  comments: TaskComment[];
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
  /** Item ID shown in the UI, e.g. INV-0001. */
  id: string;
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

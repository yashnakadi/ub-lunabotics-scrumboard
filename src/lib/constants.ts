import type {
  InventoryCategory,
  InventoryCondition,
  TaskPriority,
  TaskStatus,
  TeamId,
} from "@/types";

export const APP_NAME = "UB Lunabotics";
export const APP_TAGLINE = "Team Project Management";

export const TEAM_IDS: TeamId[] = ["software", "electrical", "mechanical"];

export const TASK_STATUSES: TaskStatus[] = [
  "todo",
  "in_progress",
  "in_review",
  "done",
];

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  in_review: "In Review",
  done: "Done",
};

export const TASK_PRIORITIES: TaskPriority[] = [
  "urgent",
  "high",
  "medium",
  "low",
];

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

/** Higher number = more important. Used for sorting. */
export const PRIORITY_RANK: Record<TaskPriority, number> = {
  low: 0,
  medium: 1,
  high: 2,
  urgent: 3,
};

export const STATUS_RANK: Record<TaskStatus, number> = {
  todo: 0,
  in_progress: 1,
  in_review: 2,
  done: 3,
};

export const INVENTORY_CATEGORIES: InventoryCategory[] = [
  "Computing",
  "Electrical",
  "Mechanical",
  "Sensors",
  "Tools",
  "Miscellaneous",
];

export const INVENTORY_CONDITIONS: InventoryCondition[] = [
  "New",
  "Good",
  "Fair",
  "Needs Repair",
  "Out of Service",
];

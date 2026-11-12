import type { Task } from "@/types";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Formats a Date as a local calendar date (YYYY-MM-DD). */
export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayKey(): string {
  return toDateKey(new Date());
}

/** Parses YYYY-MM-DD as a local date (avoids the UTC shift of `new Date(str)`). */
export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** Whole days from today until the given date key. Negative when in the past. */
export function daysUntil(key: string): number {
  const today = parseDateKey(todayKey()).getTime();
  return Math.round((parseDateKey(key).getTime() - today) / DAY_MS);
}

export function formatDate(key: string | null): string {
  if (!key) return "No due date";
  const date = parseDateKey(key);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDateTime(iso);
}

export type DueState = "none" | "overdue" | "today" | "soon" | "later" | "done";

/** Classifies a task's deadline for display and filtering. */
export function getDueState(task: Pick<Task, "dueDate" | "status">): DueState {
  if (!task.dueDate) return "none";
  if (task.status === "done") return "done";
  const days = daysUntil(task.dueDate);
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  if (days <= 3) return "soon";
  return "later";
}

export function isOverdue(task: Pick<Task, "dueDate" | "status">): boolean {
  return getDueState(task) === "overdue";
}

/** Short human phrase for a deadline, e.g. "Due in 3 days", "2 days overdue". */
export function describeDue(task: Pick<Task, "dueDate" | "status">): string {
  if (!task.dueDate) return "No due date";
  const days = daysUntil(task.dueDate);
  if (task.status === "done") return `Was due ${formatDate(task.dueDate)}`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days === -1) return "1 day overdue";
  if (days < 0) return `${-days} days overdue`;
  return `Due in ${days} days`;
}

export function createId(prefix: string): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${random}`;
}

export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

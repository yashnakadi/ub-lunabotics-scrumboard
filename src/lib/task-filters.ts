/** Pure filtering and sorting helpers for tasks. No UI or storage dependencies. */

import { PRIORITY_RANK, STATUS_RANK } from "@/lib/constants";
import { daysUntil, getDueState } from "@/lib/format";
import type { Task, TaskPriority, TaskStatus, TeamId } from "@/types";

export type AssigneeFilter = "all" | "unassigned" | string;
export type DueFilter = "all" | "overdue" | "week" | "none";

export interface TaskFilters {
  search: string;
  assignee: AssigneeFilter;
  priority: "all" | TaskPriority;
  due: DueFilter;
}

export const DEFAULT_TASK_FILTERS: TaskFilters = {
  search: "",
  assignee: "all",
  priority: "all",
  due: "all",
};

export function countActiveFilters(filters: TaskFilters): number {
  return (
    Number(filters.search.trim() !== "") +
    Number(filters.assignee !== "all") +
    Number(filters.priority !== "all") +
    Number(filters.due !== "all")
  );
}

export function matchesDueFilter(task: Task, due: DueFilter): boolean {
  switch (due) {
    case "all":
      return true;
    case "none":
      return task.dueDate === null;
    case "overdue":
      return getDueState(task) === "overdue";
    case "week": {
      if (!task.dueDate || task.status === "done") return false;
      const days = daysUntil(task.dueDate);
      return days >= 0 && days <= 7;
    }
  }
}

export function filterTasks(tasks: Task[], filters: TaskFilters): Task[] {
  const query = filters.search.trim().toLowerCase();
  return tasks.filter((task) => {
    if (filters.assignee === "unassigned" && task.assigneeId !== null) return false;
    if (
      filters.assignee !== "all" &&
      filters.assignee !== "unassigned" &&
      task.assigneeId !== filters.assignee
    )
      return false;
    if (filters.priority !== "all" && task.priority !== filters.priority) return false;
    if (!matchesDueFilter(task, filters.due)) return false;
    if (query) {
      const haystack = [task.key, task.title, task.description, ...task.tags]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

export function filterByTeam(tasks: Task[], team: TeamId | "all", allowed: TeamId[]): Task[] {
  return tasks.filter((task) =>
    team === "all" ? allowed.includes(task.teamId) : task.teamId === team,
  );
}

export function groupByStatus(tasks: Task[]): Record<TaskStatus, Task[]> {
  const groups: Record<TaskStatus, Task[]> = {
    todo: [],
    in_progress: [],
    in_review: [],
    done: [],
  };
  for (const task of tasks) groups[task.status].push(task);
  for (const list of Object.values(groups)) list.sort((a, b) => a.order - b.order);
  return groups;
}

/** Earliest deadline first; tasks without a due date go last. */
export function compareByDueDate(a: Task, b: Task): number {
  if (a.dueDate === b.dueDate) return 0;
  if (!a.dueDate) return 1;
  if (!b.dueDate) return -1;
  return a.dueDate < b.dueDate ? -1 : 1;
}

export function compareByPriority(a: Task, b: Task): number {
  return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
}

export function compareByStatus(a: Task, b: Task): number {
  return STATUS_RANK[a.status] - STATUS_RANK[b.status];
}

/** Summary counts used by the dashboard and My Tasks. */
export function summarizeTasks(tasks: Task[]) {
  return {
    total: tasks.length,
    active: tasks.filter((task) => task.status !== "done").length,
    inProgress: tasks.filter((task) => task.status === "in_progress").length,
    inReview: tasks.filter((task) => task.status === "in_review").length,
    todo: tasks.filter((task) => task.status === "todo").length,
    done: tasks.filter((task) => task.status === "done").length,
    overdue: tasks.filter((task) => getDueState(task) === "overdue").length,
  };
}

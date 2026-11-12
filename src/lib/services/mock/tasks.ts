/**
 * Mock task service backed by browser storage.
 *
 * It authorizes every call with the shared rules in `@/lib/permissions`, the
 * same way a real API must on the server.
 */

import { STATUS_LABELS } from "@/lib/constants";
import { TEAMS, USERS } from "@/lib/data/seed";
import { createId } from "@/lib/format";
import {
  canCommentOnTask,
  canCreateTask,
  canDeleteTask,
  canEditTask,
  canRemoveChecklistItem,
  canUpdateChecklist,
  canUpdateTaskStatus,
  canViewTask,
} from "@/lib/permissions";
import {
  NotFoundError,
  PermissionDeniedError,
  type TaskService,
} from "@/lib/services/types";
import type { Task, TaskComment, TeamId, User } from "@/types";

import { db, requireSessionUser } from "./db";

function now(): string {
  return new Date().toISOString();
}

function nextKey(tasks: Task[], teamId: TeamId): string {
  const prefix = TEAMS.find((team) => team.id === teamId)!.prefix;
  const highest = tasks
    .filter((task) => task.key.startsWith(`${prefix}-`))
    .reduce((max, task) => Math.max(max, Number(task.key.split("-")[1]) || 0), 0);
  return `${prefix}-${String(highest + 1).padStart(3, "0")}`;
}

function activity(task: Task, actor: User, body: string): TaskComment {
  return {
    id: createId("a"),
    taskId: task.id,
    authorId: actor.id,
    body,
    createdAt: now(),
    kind: "activity",
  };
}

function userName(id: string | null): string {
  if (!id) return "nobody";
  return USERS.find((user) => user.id === id)?.name ?? "a former member";
}

/**
 * Loads a task, checks access, applies `change`, and saves the result.
 * `change` returns the updated task (it must not mutate its argument).
 */
function mutate(
  id: string,
  authorize: (actor: User, task: Task) => boolean,
  change: (task: Task, actor: User, all: Task[]) => Task,
): Task {
  const actor = requireSessionUser();
  const tasks = db.getTasks();
  const index = tasks.findIndex((task) => task.id === id);
  const current = tasks[index];
  if (!current || !canViewTask(actor, current)) throw new NotFoundError();
  if (!authorize(actor, current)) throw new PermissionDeniedError();

  const updated = { ...change(current, actor, tasks), updatedAt: now() };
  tasks[index] = updated;
  db.setTasks(tasks);
  return updated;
}

export const mockTaskService: TaskService = {
  async list() {
    const actor = requireSessionUser();
    return db.getTasks().filter((task) => canViewTask(actor, task));
  },

  async create(input) {
    const actor = requireSessionUser();
    if (!canCreateTask(actor)) throw new PermissionDeniedError();

    const tasks = db.getTasks();
    const id = createId("t");
    const timestamp = now();
    const firstInColumn = Math.min(
      0,
      ...tasks.filter((t) => t.status === input.status).map((t) => t.order),
    );

    const task: Task = {
      id,
      key: nextKey(tasks, input.teamId),
      title: input.title.trim(),
      description: input.description.trim(),
      status: input.status,
      priority: input.priority,
      teamId: input.teamId,
      assigneeId: input.assigneeId,
      dueDate: input.dueDate,
      createdById: actor.id,
      createdAt: timestamp,
      updatedAt: timestamp,
      tags: input.tags,
      checklist: input.checklist.map((label) => ({
        id: createId("k"),
        label,
        done: false,
      })),
      comments: [],
      // New tasks appear at the top of their column.
      order: firstInColumn - 1,
    };
    task.comments.push(activity(task, actor, "created this task"));

    db.setTasks([...tasks, task]);
    return task;
  },

  async update(id, patch) {
    return mutate(id, canEditTask, (task, actor, all) => {
      const next: Task = { ...task, ...patch };
      const log: TaskComment[] = [];

      if (patch.teamId && patch.teamId !== task.teamId) {
        // Moving to another team re-keys the task with that team's prefix.
        next.key = nextKey(all, patch.teamId);
        const team = TEAMS.find((t) => t.id === patch.teamId)!;
        log.push(activity(task, actor, `moved this task to ${team.name} (was ${task.key})`));
      }
      if (patch.assigneeId !== undefined && patch.assigneeId !== task.assigneeId) {
        log.push(
          activity(
            task,
            actor,
            patch.assigneeId
              ? `assigned this to ${userName(patch.assigneeId)}`
              : "removed the assignee",
          ),
        );
      }
      if (patch.priority && patch.priority !== task.priority) {
        log.push(activity(task, actor, `set priority to ${patch.priority}`));
      }
      if (patch.dueDate !== undefined && patch.dueDate !== task.dueDate) {
        log.push(
          activity(
            task,
            actor,
            patch.dueDate ? `set the due date to ${patch.dueDate}` : "removed the due date",
          ),
        );
      }
      if (
        (patch.title !== undefined && patch.title !== task.title) ||
        (patch.description !== undefined && patch.description !== task.description)
      ) {
        log.push(activity(task, actor, "edited the task details"));
      }

      next.comments = [...task.comments, ...log];
      return next;
    });
  },

  async move(id, status, order) {
    return mutate(id, canUpdateTaskStatus, (task, actor) => {
      const next: Task = { ...task, status, order: order ?? task.order };
      if (status !== task.status) {
        next.comments = [
          ...task.comments,
          activity(
            task,
            actor,
            `moved this from ${STATUS_LABELS[task.status]} to ${STATUS_LABELS[status]}`,
          ),
        ];
      }
      return next;
    });
  },

  async remove(id) {
    const actor = requireSessionUser();
    if (!canDeleteTask(actor)) throw new PermissionDeniedError();
    const tasks = db.getTasks();
    if (!tasks.some((task) => task.id === id)) throw new NotFoundError();
    db.setTasks(tasks.filter((task) => task.id !== id));
  },

  async addChecklistItem(id, label) {
    return mutate(id, canUpdateChecklist, (task) => ({
      ...task,
      checklist: [...task.checklist, { id: createId("k"), label: label.trim(), done: false }],
    }));
  },

  async toggleChecklistItem(id, itemId, done) {
    return mutate(id, canUpdateChecklist, (task) => ({
      ...task,
      checklist: task.checklist.map((item) =>
        item.id === itemId ? { ...item, done } : item,
      ),
    }));
  },

  async removeChecklistItem(id, itemId) {
    return mutate(
      id,
      (actor) => canRemoveChecklistItem(actor),
      (task) => ({
        ...task,
        checklist: task.checklist.filter((item) => item.id !== itemId),
      }),
    );
  },

  async addComment(id, body) {
    return mutate(id, canCommentOnTask, (task, actor) => ({
      ...task,
      comments: [
        ...task.comments,
        {
          id: createId("c"),
          taskId: task.id,
          authorId: actor.id,
          body: body.trim(),
          createdAt: now(),
          kind: "comment",
        },
      ],
    }));
  },
};

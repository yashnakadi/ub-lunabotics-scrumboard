import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  PermissionDeniedError,
  ServiceError,
  type TaskPatch,
  type TaskService,
} from "@/lib/services/types";

import { toServiceError } from "./errors";
import { mapTask, TASK_SELECT, type TaskRow } from "./mappers";

/**
 * Task data access. Every call runs as the signed-in user; row level security
 * and database triggers decide what is allowed (e.g. members may only change
 * the status of tasks assigned to them). A rejected write surfaces as a
 * PermissionDeniedError.
 */

const db = () => getSupabaseBrowserClient();

function toTaskRow(patch: TaskPatch): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (patch.title !== undefined) row.title = patch.title.trim();
  if (patch.description !== undefined) row.description = patch.description.trim();
  if (patch.teamId !== undefined) row.team_id = patch.teamId;
  if (patch.assigneeId !== undefined) row.assigned_to = patch.assigneeId;
  if (patch.priority !== undefined) row.priority = patch.priority;
  if (patch.dueDate !== undefined) row.due_date = patch.dueDate;
  if (patch.tags !== undefined) row.tags = patch.tags;
  return row;
}

async function getTask(id: string) {
  const { data, error } = await db().from("tasks").select(TASK_SELECT).eq("id", id).single();
  if (error) throw toServiceError(error);
  return mapTask(data as unknown as TaskRow);
}

/** Runs an UPDATE/DELETE and fails if RLS silently matched zero rows. */
async function expectRows(
  query: PromiseLike<{ data: unknown[] | null; error: unknown }>,
): Promise<void> {
  const { data, error } = await query;
  if (error) throw toServiceError(error);
  if (!data || data.length === 0) throw new PermissionDeniedError();
}

export const supabaseTaskService: TaskService = {
  async list() {
    const { data, error } = await db()
      .from("tasks")
      .select(TASK_SELECT)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw toServiceError(error);
    return ((data ?? []) as unknown as TaskRow[]).map(mapTask);
  },

  get: getTask,

  async create(input) {
    // New tasks go to the top of their column.
    const top = await db()
      .from("tasks")
      .select("sort_order")
      .eq("status", input.status)
      .order("sort_order", { ascending: true })
      .limit(1);
    if (top.error) throw toServiceError(top.error);
    const firstOrder = (top.data?.[0]?.sort_order as number | undefined) ?? 1;

    const { data, error } = await db()
      .from("tasks")
      .insert({
        ...toTaskRow(input),
        status: input.status,
        sort_order: firstOrder - 1,
      })
      .select("id")
      .single();
    if (error) throw toServiceError(error);
    const id = (data as { id: string }).id;

    const labels = input.checklist.map((label) => label.trim()).filter(Boolean);
    if (labels.length > 0) {
      const checklist = await db()
        .from("task_checklist_items")
        .insert(labels.map((content, index) => ({ task_id: id, content, sort_order: index })));
      if (checklist.error) {
        toServiceError(checklist.error);
        throw new ServiceError("The task was created, but its checklist could not be saved.");
      }
    }
    return getTask(id);
  },

  async update(id, patch) {
    const row = toTaskRow(patch);
    if (Object.keys(row).length === 0) return getTask(id);
    await expectRows(db().from("tasks").update(row).eq("id", id).select("id"));
    return getTask(id);
  },

  async move(id, status, order) {
    const row: Record<string, unknown> = { status };
    if (order !== undefined) row.sort_order = order;
    await expectRows(db().from("tasks").update(row).eq("id", id).select("id"));
    return getTask(id);
  },

  async remove(id) {
    await expectRows(db().from("tasks").delete().eq("id", id).select("id"));
  },

  async addChecklistItem(id, label) {
    const last = await db()
      .from("task_checklist_items")
      .select("sort_order")
      .eq("task_id", id)
      .order("sort_order", { ascending: false })
      .limit(1);
    if (last.error) throw toServiceError(last.error);
    const nextOrder = ((last.data?.[0]?.sort_order as number | undefined) ?? -1) + 1;

    const { error } = await db()
      .from("task_checklist_items")
      .insert({ task_id: id, content: label.trim(), sort_order: nextOrder });
    if (error) throw toServiceError(error);
    return getTask(id);
  },

  async toggleChecklistItem(id, itemId, done) {
    await expectRows(
      db()
        .from("task_checklist_items")
        .update({ is_completed: done })
        .eq("id", itemId)
        .eq("task_id", id)
        .select("id"),
    );
    return getTask(id);
  },

  async removeChecklistItem(id, itemId) {
    await expectRows(
      db().from("task_checklist_items").delete().eq("id", itemId).eq("task_id", id).select("id"),
    );
    return getTask(id);
  },

  async addComment(id, body) {
    const { error } = await db().from("task_comments").insert({ task_id: id, content: body.trim() });
    if (error) throw toServiceError(error);
    return getTask(id);
  },
};

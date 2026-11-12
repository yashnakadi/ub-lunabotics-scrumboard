"use client";

import { Lock, Pencil, Plus, Trash2, X } from "lucide-react";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";

import {
  DueDate,
  PriorityBadge,
  StatusBadge,
  TeamBadge,
} from "@/components/shared/badges";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { SimpleSelect, type SelectOption } from "@/components/shared/simple-select";
import { UserAvatar } from "@/components/shared/user-avatar";
import { TaskFormDialog } from "@/components/tasks/task-form-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  PRIORITY_LABELS,
  STATUS_LABELS,
  TASK_PRIORITIES,
  TASK_STATUSES,
} from "@/lib/constants";
import { formatDate, formatDateTime, formatRelativeTime } from "@/lib/format";
import {
  canAssignTask,
  canCommentOnTask,
  canDeleteTask,
  canEditTask,
  canRemoveChecklistItem,
  canUpdateChecklist,
  canUpdateTaskStatus,
} from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/providers/auth-provider";
import { useData } from "@/providers/data-provider";
import type { Task, TaskActivity, TaskPriority, TaskStatus, TeamId } from "@/types";

const UNASSIGNED = "unassigned";

interface TaskDetailSheetProps {
  /** ID of the task to show, or null to close the panel. */
  taskId: string | null;
  onClose: () => void;
}

/** Side panel with a task's full details, checklist, and activity. */
export function TaskDetailSheet({ taskId, onClose }: TaskDetailSheetProps) {
  const { tasks } = useData();
  const task = taskId ? tasks.find((t) => t.id === taskId) : undefined;

  // Keep showing the last task while the panel animates closed.
  const [shown, setShown] = useState<Task | undefined>(task);
  if (task && task !== shown) setShown(task);

  return (
    <Sheet
      open={Boolean(task)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        side="right"
        className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-xl"
      >
        {shown && <TaskDetail task={shown} onClose={onClose} />}
      </SheetContent>
    </Sheet>
  );
}

function TaskDetail({ task, onClose }: { task: Task; onClose: () => void }) {
  const user = useCurrentUser();
  const { users, getUser, getTeam, updateTask, moveTask, deleteTask } = useData();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const mayEdit = canEditTask(user);
  const mayAssign = canAssignTask(user);
  const mayDelete = canDeleteTask(user);
  const mayChangeStatus = canUpdateTaskStatus(user, task);

  const assignee = getUser(task.assigneeId);
  const creator = getUser(task.createdById);

  const assigneeOptions = useMemo<SelectOption[]>(
    () => [
      { value: UNASSIGNED, label: "Unassigned" },
      ...[...users]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((u) => ({ value: u.id, label: u.name })),
    ],
    [users],
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border pr-12 pl-4 sm:pl-5">
        <span className="font-mono text-xs font-medium text-muted-foreground">{task.key}</span>
        <TeamBadge team={getTeam(task.teamId)} />
        <div className="ml-auto flex items-center gap-1">
          {mayEdit && (
            <Button variant="ghost" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil aria-hidden />
              Edit
            </Button>
          )}
          {mayDelete && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 aria-hidden />
              Delete
            </Button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-5 sm:px-5">
        <div>
          <SheetTitle className="text-lg leading-snug font-semibold text-foreground">
            {task.title}
          </SheetTitle>
          <SheetDescription className="sr-only">
            Details, checklist, and activity for {task.key}
          </SheetDescription>
          {task.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {task.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded border border-border px-1.5 py-px text-[11px] text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {!mayChangeStatus && (
          <p className="flex items-start gap-2 rounded-lg bg-secondary px-3 py-2 text-xs text-secondary-foreground">
            <Lock className="mt-px size-3.5 shrink-0 text-brand-slate" aria-hidden />
            This task is read-only for you. Only the assignee or an admin can update it.
          </p>
        )}

        <dl className="grid grid-cols-[7rem_1fr] items-center gap-x-3 gap-y-2.5 text-sm">
          <Property label="Status">
            {mayChangeStatus ? (
              <SimpleSelect
                ariaLabel="Status"
                size="sm"
                className="w-44"
                value={task.status}
                onChange={(status) => {
                  if (status !== task.status) void moveTask(task.id, status);
                }}
                options={TASK_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
              />
            ) : (
              <StatusBadge status={task.status} />
            )}
          </Property>

          <Property label="Assignee">
            {mayAssign ? (
              <SimpleSelect
                ariaLabel="Assignee"
                size="sm"
                className="w-44"
                value={task.assigneeId ?? UNASSIGNED}
                onChange={(value) => {
                  const assigneeId = value === UNASSIGNED ? null : value;
                  if (assigneeId !== task.assigneeId)
                    void updateTask(task.id, { assigneeId }, "Assignee updated");
                }}
                options={assigneeOptions}
              />
            ) : (
              <span className="inline-flex items-center gap-2">
                <UserAvatar user={assignee} size="sm" />
                {assignee?.name ?? "Unassigned"}
              </span>
            )}
          </Property>

          <Property label="Priority">
            {mayEdit ? (
              <SimpleSelect
                ariaLabel="Priority"
                size="sm"
                className="w-44"
                value={task.priority}
                onChange={(priority) => {
                  if (priority !== task.priority)
                    void updateTask(task.id, { priority }, "Priority updated");
                }}
                options={TASK_PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABELS[p] }))}
              />
            ) : (
              <PriorityBadge priority={task.priority} />
            )}
          </Property>

          <Property label="Due date">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {mayEdit && (
                <Input
                  type="date"
                  aria-label="Due date"
                  value={task.dueDate ?? ""}
                  onChange={(e) => {
                    const dueDate = e.target.value || null;
                    if (dueDate !== task.dueDate)
                      void updateTask(task.id, { dueDate }, "Due date updated");
                  }}
                  className="h-7 w-44 bg-white"
                />
              )}
              <DueDate task={task} verbose showIcon={!mayEdit} />
            </div>
          </Property>

          <Property label="Team">{getTeam(task.teamId)?.name}</Property>

          <Property label="Created by">
            <span className="inline-flex items-center gap-2">
              <UserAvatar user={creator} size="sm" />
              {creator?.name ?? "Unknown"}
            </span>
          </Property>

          <Property label="Created">{formatDateTime(task.createdAt)}</Property>
        </dl>

        <section aria-labelledby="task-description-heading">
          <SectionHeading id="task-description-heading">Description</SectionHeading>
          {task.description ? (
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
              {task.description}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">No description provided.</p>
          )}
        </section>

        <Checklist task={task} />
        <Activity task={task} />
      </div>

      {/* Rendered inside the sheet so they stack as nested dialogs. */}
      {mayEdit && <TaskFormDialog open={editOpen} onOpenChange={setEditOpen} task={task} />}
      {mayDelete && (
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title={`Delete ${task.key}?`}
          description={`"${task.title}" and its checklist and comments will be permanently removed.`}
          confirmLabel="Delete task"
          onConfirm={async () => {
            if (await deleteTask(task.id)) onClose();
          }}
        />
      )}
    </div>
  );
}

function Property({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm text-foreground">{children}</dd>
    </>
  );
}

function SectionHeading({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h3 id={id} className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
      {children}
    </h3>
  );
}

/* ------------------------------- Checklist ------------------------------- */

function Checklist({ task }: { task: Task }) {
  const user = useCurrentUser();
  const { addChecklistItem, toggleChecklistItem, removeChecklistItem } = useData();
  const [draft, setDraft] = useState("");

  const mayUpdate = canUpdateChecklist(user, task);
  const mayRemove = canRemoveChecklistItem(user);
  const done = task.checklist.filter((item) => item.done).length;
  const total = task.checklist.length;

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    const label = draft.trim();
    if (!label) return;
    setDraft("");
    await addChecklistItem(task.id, label);
  }

  if (total === 0 && !mayUpdate) return null;

  return (
    <section aria-labelledby="task-checklist-heading">
      <div className="mb-2 flex items-center gap-3">
        <h3
          id="task-checklist-heading"
          className="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
        >
          Checklist
        </h3>
        {total > 0 && (
          <>
            <div
              role="progressbar"
              aria-label="Checklist progress"
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={done}
              className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary"
            >
              <div
                className="h-full rounded-full bg-primary transition-[width]"
                style={{ width: `${(done / total) * 100}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">
              {done} of {total}
            </span>
          </>
        )}
      </div>

      {total > 0 && (
        <ul className="grid gap-0.5">
          {task.checklist.map((item) => {
            const inputId = `check-${item.id}`;
            return (
              <li
                key={item.id}
                className="group flex items-start gap-2.5 rounded-md px-1.5 py-1.5 hover:bg-secondary/70"
              >
                <Checkbox
                  id={inputId}
                  checked={item.done}
                  disabled={!mayUpdate}
                  onCheckedChange={(checked) =>
                    void toggleChecklistItem(task.id, item.id, Boolean(checked))
                  }
                  className="mt-0.5 bg-white"
                />
                <label
                  htmlFor={inputId}
                  className={cn(
                    "min-w-0 flex-1 text-sm leading-snug",
                    mayUpdate && "cursor-pointer",
                    item.done && "text-muted-foreground line-through",
                  )}
                >
                  {item.label}
                </label>
                {mayRemove && (
                  <button
                    type="button"
                    onClick={() => void removeChecklistItem(task.id, item.id)}
                    aria-label={`Remove "${item.label}"`}
                    className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100"
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {mayUpdate && (
        <form onSubmit={handleAdd} className="mt-2 flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add an item"
            aria-label="New checklist item"
            className="h-8 bg-white"
          />
          <Button type="submit" variant="outline" disabled={!draft.trim()}>
            <Plus aria-hidden />
            Add
          </Button>
        </form>
      )}
    </section>
  );
}

/* -------------------------------- Activity ------------------------------- */

/** Turns a database activity record into a sentence fragment. */
function describeActivity(
  entry: TaskActivity,
  userName: (id: string) => string | undefined,
  teamName: (id: TeamId) => string | undefined,
): string {
  const { from, to } = entry.details;
  switch (entry.action) {
    case "created":
      return "created this task";
    case "status_changed":
      return `moved this from ${STATUS_LABELS[from as TaskStatus] ?? from} to ${STATUS_LABELS[to as TaskStatus] ?? to}`;
    case "assignee_changed":
      return to ? `assigned this to ${userName(to) ?? "a former member"}` : "removed the assignee";
    case "priority_changed":
      return `set priority to ${(PRIORITY_LABELS[to as TaskPriority] ?? to ?? "").toLowerCase()}`;
    case "due_date_changed":
      return to ? `set the due date to ${formatDate(to)}` : "removed the due date";
    case "team_changed":
      return `moved this task to ${teamName(to as TeamId) ?? to}${
        entry.details.from_key ? ` (was ${entry.details.from_key})` : ""
      }`;
    case "details_edited":
      return "edited the task details";
    default:
      return "updated this task";
  }
}

function Activity({ task }: { task: Task }) {
  const user = useCurrentUser();
  const { getUser, getTeam, addComment } = useData();
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);

  const mayComment = canCommentOnTask(user, task);
  const entries = useMemo(
    () =>
      [
        ...task.comments.map((comment) => ({ type: "comment" as const, ...comment })),
        ...task.activity.map((activity) => ({ type: "activity" as const, ...activity })),
      ].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [task.comments, task.activity],
  );

  async function submit() {
    const body = draft.trim();
    if (!body || posting) return;
    setPosting(true);
    const ok = await addComment(task.id, body);
    setPosting(false);
    if (ok) setDraft("");
  }

  return (
    <section aria-labelledby="task-activity-heading">
      <SectionHeading id="task-activity-heading">Activity</SectionHeading>

      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">No comments or activity yet.</p>
      ) : (
        <ol className="grid gap-3">
          {entries.map((entry) => {
            if (entry.type === "activity") {
              const actor = getUser(entry.actorId);
              const actorName = entry.actorId ? (actor?.name ?? "A former member") : "An administrator";
              return (
                <li key={entry.id} className="flex items-start gap-2.5 text-xs text-muted-foreground">
                  <span className="flex w-6 shrink-0 justify-center pt-1.5" aria-hidden>
                    <span className="size-1.5 rounded-full bg-brand-slate/50" />
                  </span>
                  <p className="min-w-0 leading-relaxed">
                    <span className="font-medium text-foreground">{actorName}</span>{" "}
                    {describeActivity(entry, (id) => getUser(id)?.name, (id) => getTeam(id)?.name)}
                    <span className="whitespace-nowrap"> · {formatRelativeTime(entry.createdAt)}</span>
                  </p>
                </li>
              );
            }

            const author = getUser(entry.authorId);
            const name = author?.name ?? "Former member";
            return (
              <li key={entry.id} className="flex items-start gap-2.5">
                <UserAvatar user={author} size="sm" className="mt-0.5" />
                <div className="min-w-0 flex-1 rounded-lg border border-border bg-white px-3 py-2">
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{name}</span>
                    <span> · {formatRelativeTime(entry.createdAt)}</span>
                  </p>
                  <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                    {entry.body}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {mayComment && (
        <form
          className="mt-3 flex items-start gap-2.5"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <UserAvatar user={user} size="sm" className="mt-1" />
          <div className="min-w-0 flex-1 space-y-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void submit();
                }
              }}
              placeholder="Write a comment…"
              aria-label="Write a comment"
              rows={2}
              className="min-h-16 bg-white"
            />
            <div className="flex items-center justify-between gap-2">
              <span className="hidden text-[11px] text-muted-foreground sm:inline">
                Press Ctrl/⌘ + Enter to post
              </span>
              <Button type="submit" size="sm" disabled={!draft.trim() || posting} className="ml-auto">
                Comment
              </Button>
            </div>
          </div>
        </form>
      )}
    </section>
  );
}

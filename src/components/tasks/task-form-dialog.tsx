"use client";

import { Info, Plus, X } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";

import { Field } from "@/components/shared/field";
import { SimpleSelect, type SelectOption } from "@/components/shared/simple-select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  PRIORITY_LABELS,
  STATUS_LABELS,
  TASK_PRIORITIES,
  TASK_STATUSES,
} from "@/lib/constants";
import type { TaskInput } from "@/lib/services";
import { useData } from "@/providers/data-provider";
import type { Task, TaskPriority, TaskStatus, TeamId } from "@/types";

const UNASSIGNED = "unassigned";
const TITLE_MAX = 120;

interface TaskFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pass a task to edit it; omit to create a new one. */
  task?: Task;
  /** Initial values for a new task. */
  defaults?: { teamId?: TeamId; status?: TaskStatus };
  onCreated?: (task: Task) => void;
}

/** Admin dialog for creating or editing a task. */
export function TaskFormDialog({ open, onOpenChange, task, defaults, onCreated }: TaskFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 p-0 sm:max-w-xl">
        {/* The form mounts each time the dialog opens, so it always starts fresh. */}
        <TaskForm
          task={task}
          defaults={defaults}
          onDone={() => onOpenChange(false)}
          onCreated={onCreated}
        />
      </DialogContent>
    </Dialog>
  );
}

interface TaskFormProps {
  task?: Task;
  defaults?: { teamId?: TeamId; status?: TaskStatus };
  onDone: () => void;
  onCreated?: (task: Task) => void;
}

function TaskForm({ task, defaults, onDone, onCreated }: TaskFormProps) {
  const { teams, users, createTask, updateTask } = useData();
  const editing = Boolean(task);

  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [teamId, setTeamId] = useState<TeamId>(task?.teamId ?? defaults?.teamId ?? teams[0].id);
  const [assigneeId, setAssigneeId] = useState(task?.assigneeId ?? UNASSIGNED);
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? defaults?.status ?? "todo");
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? "medium");
  const [dueDate, setDueDate] = useState(task?.dueDate ?? "");
  const [tags, setTags] = useState(task?.tags.join(", ") ?? "");
  const [checklist, setChecklist] = useState<string[]>([]);
  const [checklistDraft, setChecklistDraft] = useState("");
  const [titleError, setTitleError] = useState<string>();
  const [saving, setSaving] = useState(false);

  const teamOptions = useMemo<SelectOption<TeamId>[]>(
    () => teams.map((team) => ({ value: team.id, label: team.name })),
    [teams],
  );

  const assigneeOptions = useMemo<SelectOption[]>(() => {
    const teamName = (id: TeamId) => teams.find((team) => team.id === id)?.name ?? id;
    return [
      { value: UNASSIGNED, label: "Unassigned" },
      ...[...users]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((user) => ({
          value: user.id,
          label: `${user.name} · ${user.teamIds.map(teamName).join(", ")}`,
        })),
    ];
  }, [users, teams]);

  const assignee = users.find((user) => user.id === assigneeId);
  const selectedTeam = teams.find((team) => team.id === teamId);
  const crossTeam =
    assignee && assignee.role !== "admin" && !assignee.teamIds.includes(teamId);

  function addChecklistItem() {
    const label = checklistDraft.trim();
    if (!label) return;
    setChecklist((items) => [...items, label]);
    setChecklistDraft("");
  }

  function validateTitle(value: string): string | undefined {
    const trimmed = value.trim();
    if (!trimmed) return "Enter a title for the task.";
    if (trimmed.length < 3) return "The title must be at least 3 characters.";
    if (trimmed.length > TITLE_MAX) return `Keep the title under ${TITLE_MAX} characters.`;
    return undefined;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const error = validateTitle(title);
    setTitleError(error);
    if (error) {
      document.getElementById("task-title")?.focus();
      return;
    }

    const shared = {
      title: title.trim(),
      description: description.trim(),
      teamId,
      assigneeId: assigneeId === UNASSIGNED ? null : assigneeId,
      priority,
      dueDate: dueDate || null,
      tags: [
        ...new Set(
          tags
            .split(",")
            .map((tag) => tag.trim().toLowerCase())
            .filter(Boolean),
        ),
      ],
    };

    setSaving(true);
    if (task) {
      const updated = await updateTask(task.id, shared, `Saved changes to ${task.key}`);
      setSaving(false);
      if (updated) onDone();
      return;
    }

    const pending = checklistDraft.trim();
    const input: TaskInput = {
      ...shared,
      status,
      checklist: pending ? [...checklist, pending] : checklist,
    };
    const created = await createTask(input);
    setSaving(false);
    if (created) {
      onCreated?.(created);
      onDone();
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-col">
      <div className="shrink-0 border-b border-border px-4 py-3.5 pr-12">
        <DialogTitle>{editing ? `Edit ${task?.key}` : "New task"}</DialogTitle>
        <DialogDescription className="mt-1 text-xs">
          {editing
            ? "Update the task details. Status and checklist are managed from the task panel."
            : "Create a task and assign it to any team member."}
        </DialogDescription>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4">
        <Field label="Title" htmlFor="task-title" error={titleError} required>
          <Input
            id="task-title"
            value={title}
            maxLength={TITLE_MAX + 20}
            placeholder="e.g. Calibrate the mast camera"
            onChange={(e) => {
              setTitle(e.target.value);
              if (titleError) setTitleError(validateTitle(e.target.value));
            }}
            aria-invalid={Boolean(titleError) || undefined}
            aria-describedby={titleError ? "task-title-error" : undefined}
            aria-required
          />
        </Field>

        <Field label="Description" htmlFor="task-description">
          <Textarea
            id="task-description"
            value={description}
            rows={4}
            placeholder="What needs to be done, and how will we know it's finished?"
            onChange={(e) => setDescription(e.target.value)}
            className="min-h-24 bg-white"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Team" htmlFor="task-team" required>
            <SimpleSelect id="task-team" value={teamId} onChange={setTeamId} options={teamOptions} />
          </Field>
          <Field label="Assignee" htmlFor="task-assignee">
            <SimpleSelect
              id="task-assignee"
              value={assigneeId}
              onChange={setAssigneeId}
              options={assigneeOptions}
            />
          </Field>
        </div>

        {crossTeam && assignee && selectedTeam && (
          <p className="-mt-1 flex items-start gap-2 rounded-lg bg-secondary px-3 py-2 text-xs text-secondary-foreground">
            <Info className="mt-px size-3.5 shrink-0 text-brand-slate" aria-hidden />
            {assignee.name} isn&apos;t on the {selectedTeam.name} team. They&apos;ll find this task
            under My Tasks, but won&apos;t see the {selectedTeam.name} board.
          </p>
        )}

        <div className={editing ? "grid gap-4 sm:grid-cols-2" : "grid gap-4 sm:grid-cols-3"}>
          {!editing && (
            <Field label="Status" htmlFor="task-status">
              <SimpleSelect
                id="task-status"
                value={status}
                onChange={setStatus}
                options={TASK_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
              />
            </Field>
          )}
          <Field label="Priority" htmlFor="task-priority">
            <SimpleSelect
              id="task-priority"
              value={priority}
              onChange={setPriority}
              options={TASK_PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABELS[p] }))}
            />
          </Field>
          <Field label="Due date" htmlFor="task-due">
            <Input
              id="task-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="bg-white"
            />
          </Field>
        </div>

        <Field label="Tags" htmlFor="task-tags" hint="Optional. Separate tags with commas.">
          <Input
            id="task-tags"
            value={tags}
            placeholder="autonomy, ros2"
            onChange={(e) => setTags(e.target.value)}
          />
        </Field>

        {!editing && (
          <Field label="Checklist" htmlFor="task-checklist" hint="Optional subtasks.">
            {checklist.length > 0 && (
              <ul className="grid gap-1">
                {checklist.map((label, index) => (
                  <li
                    key={`${label}-${index}`}
                    className="flex items-center gap-2 rounded-md bg-secondary py-1 pr-1 pl-2.5 text-sm"
                  >
                    <span className="min-w-0 flex-1 truncate">{label}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Remove "${label}"`}
                      onClick={() => setChecklist((items) => items.filter((_, i) => i !== index))}
                    >
                      <X />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <Input
                id="task-checklist"
                value={checklistDraft}
                placeholder="Add a checklist item"
                onChange={(e) => setChecklistDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addChecklistItem();
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={addChecklistItem}
                disabled={!checklistDraft.trim()}
              >
                <Plus aria-hidden />
                Add
              </Button>
            </div>
          </Field>
        )}
      </div>

      <div className="flex shrink-0 flex-col-reverse gap-2 rounded-b-xl border-t border-border bg-muted/60 px-4 py-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onDone} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {editing ? "Save changes" : "Create task"}
        </Button>
      </div>
    </form>
  );
}

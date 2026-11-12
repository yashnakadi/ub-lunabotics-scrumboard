"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ListChecks, MessageSquare } from "lucide-react";
import type { KeyboardEvent } from "react";

import { DueDate, PriorityBadge, TeamBadge } from "@/components/shared/badges";
import { UserAvatar } from "@/components/shared/user-avatar";
import { cn } from "@/lib/utils";
import { useData } from "@/providers/data-provider";
import type { Task } from "@/types";

const MAX_TAGS = 2;

/** Visual content of a card. Shared by the board and the drag overlay. */
export function TaskCardContent({ task }: { task: Task }) {
  const { getUser, getTeam } = useData();
  const assignee = getUser(task.assigneeId);
  const doneCount = task.checklist.filter((item) => item.done).length;
  const commentCount = task.comments.filter((c) => c.kind === "comment").length;
  const extraTags = task.tags.length - MAX_TAGS;

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] font-medium tracking-tight text-muted-foreground">
          {task.key}
        </span>
        <PriorityBadge priority={task.priority} />
      </div>

      <p className="mt-1.5 line-clamp-2 text-[13px] leading-snug font-medium text-foreground">
        {task.title}
      </p>
      {task.description && (
        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {task.description}
        </p>
      )}

      {task.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {task.tags.slice(0, MAX_TAGS).map((tag) => (
            <span
              key={tag}
              className="rounded border border-border px-1.5 py-px text-[10.5px] text-muted-foreground"
            >
              {tag}
            </span>
          ))}
          {extraTags > 0 && (
            <span className="px-0.5 py-px text-[10.5px] text-muted-foreground">+{extraTags}</span>
          )}
        </div>
      )}

      <div className="mt-2.5 flex items-center gap-2.5 border-t border-border/70 pt-2">
        <TeamBadge team={getTeam(task.teamId)} />
        <DueDate task={task} />
        <div className="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground">
          {task.checklist.length > 0 && (
            <span className="inline-flex items-center gap-0.5" title="Checklist progress">
              <ListChecks className="size-3.5" aria-hidden />
              <span className="sr-only">Checklist </span>
              {doneCount}/{task.checklist.length}
            </span>
          )}
          {commentCount > 0 && (
            <span className="inline-flex items-center gap-0.5" title="Comments">
              <MessageSquare className="size-3.5" aria-hidden />
              {commentCount}
              <span className="sr-only"> comments</span>
            </span>
          )}
          <UserAvatar user={assignee} size="sm" />
        </div>
      </div>
    </>
  );
}

export const taskCardClass =
  "relative rounded-lg border border-border bg-white p-2.5 text-left shadow-xs transition-shadow";

interface SortableTaskCardProps {
  task: Task;
  /** Whether the current user may drag this card. */
  movable: boolean;
  onOpen: (taskId: string) => void;
}

/** A card in a Kanban column. Click or press Enter to open; drag (or Space) to move. */
export function SortableTaskCard({ task, movable, onOpen }: SortableTaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled: { draggable: !movable },
  });

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (movable) listeners?.onKeyDown?.(event);
    if (event.key === "Enter" && !isDragging) {
      event.preventDefault();
      onOpen(task.id);
    }
  }

  const interactionProps = movable
    ? { ...attributes, ...listeners }
    : { role: "button" as const, tabIndex: 0 };

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...interactionProps}
      aria-label={`${task.key}: ${task.title}`}
      onClick={() => onOpen(task.id)}
      onKeyDown={handleKeyDown}
      className={cn(
        taskCardClass,
        "touch-manipulation hover:border-input hover:shadow-sm",
        movable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
        isDragging && "opacity-40",
      )}
    >
      <TaskCardContent task={task} />
    </div>
  );
}

import { CalendarDays, Code, Cog, Globe, Zap, type LucideIcon } from "lucide-react";

import { PRIORITY_LABELS, STATUS_LABELS } from "@/lib/constants";
import { describeDue, formatDate, getDueState, type DueState } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Task, TaskPriority, TaskStatus, Team, TeamId } from "@/types";

const pill =
  "inline-flex h-5 shrink-0 items-center gap-1.5 rounded-md px-1.5 text-[11px] font-medium whitespace-nowrap";

/* ------------------------------- Priority -------------------------------- */

const PRIORITY_STYLES: Record<TaskPriority, { pill: string; dot: string }> = {
  low: { pill: "bg-slate-100 text-slate-600", dot: "bg-slate-400" },
  medium: { pill: "bg-sky-50 text-sky-800", dot: "bg-sky-500" },
  high: { pill: "bg-amber-50 text-amber-800", dot: "bg-amber-500" },
  urgent: { pill: "bg-red-50 text-red-800", dot: "bg-red-500" },
};

export function PriorityBadge({
  priority,
  className,
}: {
  priority: TaskPriority;
  className?: string;
}) {
  const style = PRIORITY_STYLES[priority];
  return (
    <span className={cn(pill, style.pill, className)}>
      <span className={cn("size-1.5 rounded-full", style.dot)} aria-hidden />
      <span className="sr-only">Priority: </span>
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

/* -------------------------------- Status --------------------------------- */

export const STATUS_DOT: Record<TaskStatus, string> = {
  todo: "bg-slate-400",
  in_progress: "bg-sky-600",
  in_review: "bg-amber-500",
  done: "bg-emerald-600",
};

export function StatusBadge({
  status,
  className,
}: {
  status: TaskStatus;
  className?: string;
}) {
  return (
    <span className={cn(pill, "border border-border bg-white text-foreground", className)}>
      <span className={cn("size-1.5 rounded-full", STATUS_DOT[status])} aria-hidden />
      {STATUS_LABELS[status]}
    </span>
  );
}

/* --------------------------------- Team ---------------------------------- */

export const TEAM_ICONS: Record<TeamId, LucideIcon> = {
  software: Code,
  electrical: Zap,
  mechanical: Cog,
};

export function TeamBadge({
  team,
  className,
}: {
  /** Pass null for organization-wide records (shared inventory). */
  team: Team | null | undefined;
  className?: string;
}) {
  const Icon = team ? TEAM_ICONS[team.id] : Globe;
  return (
    <span className={cn(pill, "bg-secondary text-secondary-foreground", className)}>
      <Icon className="size-3 text-brand-slate" aria-hidden />
      {team ? team.name : "Shared"}
    </span>
  );
}

/* ------------------------------- Due date -------------------------------- */

const DUE_STYLES: Record<DueState, string> = {
  none: "text-muted-foreground",
  later: "text-muted-foreground",
  done: "text-muted-foreground",
  soon: "text-amber-700",
  today: "text-amber-700 font-medium",
  overdue: "text-red-700 font-medium",
};

export function DueDate({
  task,
  showIcon = true,
  verbose = false,
  className,
}: {
  task: Pick<Task, "dueDate" | "status">;
  showIcon?: boolean;
  /** Adds the relative phrase, e.g. "Nov 14 · Due in 3 days". */
  verbose?: boolean;
  className?: string;
}) {
  const state = getDueState(task);
  const description = describeDue(task);

  if (!task.dueDate) {
    return <span className={cn("text-xs text-muted-foreground", className)}>No due date</span>;
  }

  return (
    <span
      title={description}
      className={cn(
        "inline-flex items-center gap-1 text-xs whitespace-nowrap",
        DUE_STYLES[state],
        className,
      )}
    >
      {showIcon && <CalendarDays className="size-3.5" aria-hidden />}
      <span>
        {formatDate(task.dueDate)}
        {state === "overdue" && !verbose && <span className="sr-only"> (overdue)</span>}
      </span>
      {verbose && state !== "done" && state !== "later" && (
        <span aria-hidden>· {description.replace(/^Due /, "")}</span>
      )}
      {verbose && <span className="sr-only">{description}</span>}
    </span>
  );
}

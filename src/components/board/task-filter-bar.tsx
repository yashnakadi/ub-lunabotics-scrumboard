"use client";

import { Search, X } from "lucide-react";
import { useMemo } from "react";

import { SimpleSelect, type SelectOption } from "@/components/shared/simple-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PRIORITY_LABELS, TASK_PRIORITIES } from "@/lib/constants";
import {
  countActiveFilters,
  DEFAULT_TASK_FILTERS,
  type DueFilter,
  type TaskFilters,
} from "@/lib/task-filters";
import { cn } from "@/lib/utils";
import type { TaskPriority, User } from "@/types";

const DUE_OPTIONS: SelectOption<DueFilter>[] = [
  { value: "all", label: "Any due date" },
  { value: "overdue", label: "Overdue" },
  { value: "week", label: "Due in 7 days" },
  { value: "none", label: "No due date" },
];

const PRIORITY_OPTIONS: SelectOption<"all" | TaskPriority>[] = [
  { value: "all", label: "Any priority" },
  ...TASK_PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABELS[p] })),
];

interface TaskFilterBarProps {
  filters: TaskFilters;
  onChange: (filters: TaskFilters) => void;
  /** People offered in the assignee filter. */
  users: User[];
  currentUserId: string;
  className?: string;
}

/** Search plus assignee, priority, and due-date filters for the board. */
export function TaskFilterBar({
  filters,
  onChange,
  users,
  currentUserId,
  className,
}: TaskFilterBarProps) {
  const assigneeOptions = useMemo<SelectOption[]>(
    () => [
      { value: "all", label: "Any assignee" },
      { value: currentUserId, label: "Assigned to me" },
      { value: "unassigned", label: "Unassigned" },
      ...[...users]
        .filter((user) => user.id !== currentUserId)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((user) => ({ value: user.id, label: user.name })),
    ],
    [users, currentUserId],
  );

  const active = countActiveFilters(filters);

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <div className="relative w-full sm:w-56">
        <Search
          className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-brand-slate"
          aria-hidden
        />
        <Input
          type="search"
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          placeholder="Search tasks"
          aria-label="Search tasks"
          className="bg-white pl-8"
        />
      </div>
      <SimpleSelect
        ariaLabel="Filter by assignee"
        className="w-[calc(50%-0.25rem)] sm:w-44"
        value={filters.assignee}
        onChange={(assignee) => onChange({ ...filters, assignee })}
        options={assigneeOptions}
      />
      <SimpleSelect
        ariaLabel="Filter by priority"
        className="w-[calc(50%-0.25rem)] sm:w-36"
        value={filters.priority}
        onChange={(priority) => onChange({ ...filters, priority })}
        options={PRIORITY_OPTIONS}
      />
      <SimpleSelect
        ariaLabel="Filter by due date"
        className="w-[calc(50%-0.25rem)] sm:w-40"
        value={filters.due}
        onChange={(due) => onChange({ ...filters, due })}
        options={DUE_OPTIONS}
      />
      {active > 0 && (
        <Button
          variant="ghost"
          className="text-muted-foreground"
          onClick={() => onChange(DEFAULT_TASK_FILTERS)}
        >
          <X aria-hidden />
          Clear filters
        </Button>
      )}
    </div>
  );
}

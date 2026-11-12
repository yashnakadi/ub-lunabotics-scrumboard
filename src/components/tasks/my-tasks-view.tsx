"use client";

import {
  CalendarClock,
  CircleAlert,
  CircleCheck,
  ClipboardList,
  ListTodo,
  Search,
  SearchX,
} from "lucide-react";
import { useMemo, useState } from "react";

import { PageBody, PageHeader } from "@/components/layout/page-header";
import { DueDate, PriorityBadge, StatusBadge, TeamBadge } from "@/components/shared/badges";
import { EmptyState } from "@/components/shared/empty-state";
import { SimpleSelect, type SelectOption } from "@/components/shared/simple-select";
import {
  nextSort,
  SortHeader,
  type SortState,
} from "@/components/shared/sort-header";
import { StatCard } from "@/components/shared/stat-card";
import { TaskDetailSheet } from "@/components/tasks/task-detail-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import {
  PRIORITY_LABELS,
  STATUS_LABELS,
  TASK_PRIORITIES,
  TASK_STATUSES,
} from "@/lib/constants";
import {
  compareByDueDate,
  compareByPriority,
  compareByStatus,
  matchesDueFilter,
  summarizeTasks,
} from "@/lib/task-filters";
import { useCurrentUser } from "@/providers/auth-provider";
import { useData } from "@/providers/data-provider";
import type { Task, TaskPriority, TaskStatus, TeamId } from "@/types";

type SortKey = "title" | "team" | "status" | "priority" | "due";
type StatusFilter = "open" | "all" | TaskStatus;

const STATUS_OPTIONS: SelectOption<StatusFilter>[] = [
  { value: "open", label: "Open tasks" },
  { value: "all", label: "All statuses" },
  ...TASK_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] })),
];

const PRIORITY_OPTIONS: SelectOption<"all" | TaskPriority>[] = [
  { value: "all", label: "Any priority" },
  ...TASK_PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABELS[p] })),
];

export function MyTasksView() {
  const user = useCurrentUser();
  const { tasks, teams, getTeam } = useData();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("open");
  const [team, setTeam] = useState<"all" | TeamId>("all");
  const [priority, setPriority] = useState<"all" | TaskPriority>("all");
  const [sort, setSort] = useState<SortState<SortKey>>({ key: "due", direction: "asc" });
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  const mine = useMemo(() => tasks.filter((task) => task.assigneeId === user.id), [tasks, user.id]);
  const summary = useMemo(() => summarizeTasks(mine), [mine]);
  const dueThisWeek = useMemo(
    () => mine.filter((task) => matchesDueFilter(task, "week")).length,
    [mine],
  );

  // Only offer teams the user actually has tasks in.
  const teamOptions = useMemo<SelectOption<"all" | TeamId>[]>(() => {
    const ids = new Set(mine.map((task) => task.teamId));
    return [
      { value: "all", label: "All teams" },
      ...teams.filter((t) => ids.has(t.id)).map((t) => ({ value: t.id, label: t.name })),
    ];
  }, [mine, teams]);

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = mine.filter((task) => {
      if (status === "open" && task.status === "done") return false;
      if (status !== "open" && status !== "all" && task.status !== status) return false;
      if (team !== "all" && task.teamId !== team) return false;
      if (priority !== "all" && task.priority !== priority) return false;
      if (query && !`${task.key} ${task.title}`.toLowerCase().includes(query)) return false;
      return true;
    });

    const comparators: Record<SortKey, (a: Task, b: Task) => number> = {
      title: (a, b) => a.title.localeCompare(b.title),
      team: (a, b) => a.teamId.localeCompare(b.teamId),
      status: compareByStatus,
      priority: compareByPriority,
      due: compareByDueDate,
    };
    const direction = sort.direction === "asc" ? 1 : -1;
    return filtered.sort(
      (a, b) => comparators[sort.key](a, b) * direction || compareByDueDate(a, b),
    );
  }, [mine, search, status, team, priority, sort]);

  const filtersActive =
    search.trim() !== "" || status !== "open" || team !== "all" || priority !== "all";

  function resetFilters() {
    setSearch("");
    setStatus("open");
    setTeam("all");
    setPriority("all");
  }

  const onSort = (key: SortKey) => setSort((current) => nextSort(current, key));

  return (
    <>
      <PageHeader title="My Tasks" context={`Assigned to ${user.name}`} />
      <PageBody>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Open" value={summary.active} icon={ListTodo} hint="Not yet done" />
          <StatCard
            label="Overdue"
            value={summary.overdue}
            icon={CircleAlert}
            tone={summary.overdue > 0 ? "alert" : "default"}
            hint={summary.overdue > 0 ? "Past the due date" : "Nothing overdue"}
          />
          <StatCard
            label="Due in 7 days"
            value={dueThisWeek}
            icon={CalendarClock}
            hint="Upcoming deadlines"
          />
          <StatCard label="Completed" value={summary.done} icon={CircleCheck} hint="Marked done" />
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-white">
          <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
            <div className="relative w-full sm:w-60">
              <Search
                className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-brand-slate"
                aria-hidden
              />
              <Input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search my tasks"
                aria-label="Search my tasks"
                className="pl-8"
              />
            </div>
            <SimpleSelect
              ariaLabel="Filter by status"
              className="w-[calc(50%-0.25rem)] sm:w-40"
              value={status}
              onChange={setStatus}
              options={STATUS_OPTIONS}
            />
            <SimpleSelect
              ariaLabel="Filter by team"
              className="w-[calc(50%-0.25rem)] sm:w-36"
              value={team}
              onChange={setTeam}
              options={teamOptions}
            />
            <SimpleSelect
              ariaLabel="Filter by priority"
              className="w-[calc(50%-0.25rem)] sm:w-36"
              value={priority}
              onChange={setPriority}
              options={PRIORITY_OPTIONS}
            />
            {filtersActive && (
              <Button variant="ghost" className="text-muted-foreground" onClick={resetFilters}>
                Reset
              </Button>
            )}
            <p className="ml-auto text-xs text-muted-foreground tabular-nums">
              {rows.length} {rows.length === 1 ? "task" : "tasks"}
            </p>
          </div>

          {mine.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="No tasks assigned to you"
              description="When an admin assigns you a task, it will show up here."
            />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title="No tasks match these filters"
              description={
                status === "open" && !search && team === "all" && priority === "all"
                  ? "You're all caught up. Switch the status filter to see completed tasks."
                  : "Try a different search or reset the filters."
              }
              action={
                filtersActive ? (
                  <Button variant="outline" onClick={resetFilters}>
                    Reset filters
                  </Button>
                ) : (
                  <Button variant="outline" onClick={() => setStatus("all")}>
                    Show all statuses
                  </Button>
                )
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <SortHeader label="Task" sortKey="title" sort={sort} onSort={onSort} className="pl-4" />
                  <SortHeader
                    label="Team"
                    sortKey="team"
                    sort={sort}
                    onSort={onSort}
                    className="hidden md:table-cell"
                  />
                  <SortHeader label="Status" sortKey="status" sort={sort} onSort={onSort} />
                  <SortHeader
                    label="Priority"
                    sortKey="priority"
                    sort={sort}
                    onSort={onSort}
                    className="hidden sm:table-cell"
                  />
                  <SortHeader label="Due date" sortKey="due" sort={sort} onSort={onSort} className="pr-4" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((task) => (
                  <TableRow
                    key={task.id}
                    onClick={() => setOpenTaskId(task.id)}
                    className="cursor-pointer"
                  >
                    <TableCell className="w-full max-w-0 py-2.5 pl-4 whitespace-normal sm:w-[46%]">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setOpenTaskId(task.id);
                        }}
                        className="block w-full rounded text-left"
                      >
                        <span className="block truncate text-[13px] font-medium text-foreground">
                          {task.title}
                        </span>
                        <span className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                          <span className="font-mono">{task.key}</span>
                          <span className="md:hidden">{getTeam(task.teamId)?.name}</span>
                          <span className="sm:hidden">· {PRIORITY_LABELS[task.priority]}</span>
                        </span>
                      </button>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <TeamBadge team={getTeam(task.teamId)} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={task.status} />
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <PriorityBadge priority={task.priority} />
                    </TableCell>
                    <TableCell className="pr-4">
                      <DueDate task={task} verbose />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </PageBody>

      <TaskDetailSheet taskId={openTaskId} onClose={() => setOpenTaskId(null)} />
    </>
  );
}

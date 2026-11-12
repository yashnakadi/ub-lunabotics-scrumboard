"use client";

import { ClipboardList, Plus, SearchX, SlidersHorizontal, Users } from "lucide-react";
import { useMemo, useState } from "react";

import { KanbanBoard } from "@/components/board/kanban-board";
import { TaskFilterBar } from "@/components/board/task-filter-bar";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { TeamTabs, type TeamFilter } from "@/components/shared/team-tabs";
import { TaskDetailSheet } from "@/components/tasks/task-detail-sheet";
import { TaskFormDialog } from "@/components/tasks/task-form-dialog";
import { Button } from "@/components/ui/button";
import {
  canCreateTask,
  canUpdateTaskStatus,
  canViewAllTeams,
  getAccessibleTeamIds,
} from "@/lib/permissions";
import {
  countActiveFilters,
  DEFAULT_TASK_FILTERS,
  filterByTeam,
  filterTasks,
  type TaskFilters,
} from "@/lib/task-filters";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/providers/auth-provider";
import { useData } from "@/providers/data-provider";
import type { TaskStatus } from "@/types";

export function BoardView() {
  const user = useCurrentUser();
  const { tasks, teams, users, moveTask } = useData();

  const allowedTeamIds = useMemo(() => getAccessibleTeamIds(user), [user]);
  const allowedTeams = useMemo(
    () => teams.filter((team) => allowedTeamIds.includes(team.id)),
    [teams, allowedTeamIds],
  );
  const showAll = canViewAllTeams(user);
  const mayCreate = canCreateTask(user);

  const [team, setTeam] = useState<TeamFilter>(showAll ? "all" : (allowedTeamIds[0] ?? "all"));
  const [filters, setFilters] = useState<TaskFilters>(DEFAULT_TASK_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [createStatus, setCreateStatus] = useState<TaskStatus | null>(null);
  // Remembers the last column used so the dialog keeps its content while closing.
  const [lastCreateStatus, setLastCreateStatus] = useState<TaskStatus>("todo");

  const teamTasks = useMemo(
    () => filterByTeam(tasks, team, allowedTeamIds),
    [tasks, team, allowedTeamIds],
  );
  const visibleTasks = useMemo(() => filterTasks(teamTasks, filters), [teamTasks, filters]);

  const activeFilters = countActiveFilters(filters);
  const teamName =
    team === "all" ? "All Teams" : `${teams.find((t) => t.id === team)?.name ?? ""} Team`;

  function openCreate(status: TaskStatus) {
    setLastCreateStatus(status);
    setCreateStatus(status);
  }

  if (allowedTeams.length === 0) {
    return (
      <>
        <PageHeader title="Scrum Board" />
        <EmptyState
          icon={Users}
          title="You aren't on a team yet"
          description="Ask an admin to add you to Software, Electrical, or Mechanical to see a board here."
          className="flex-1"
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Scrum Board"
        context={teamName}
        actions={
          mayCreate && (
            <Button onClick={() => openCreate("todo")}>
              <Plus aria-hidden />
              New task
            </Button>
          )
        }
      />

      <div className="shrink-0 space-y-2.5 border-b border-border bg-white px-3 py-2.5 sm:px-4 lg:px-6">
        <div className="flex items-center gap-2">
          <TeamTabs
            teams={allowedTeams}
            value={team}
            onChange={setTeam}
            allLabel={showAll ? "All Teams" : undefined}
          />
          <p className="ml-auto hidden text-xs text-muted-foreground tabular-nums md:block">
            {visibleTasks.length === teamTasks.length
              ? `${teamTasks.length} tasks`
              : `${visibleTasks.length} of ${teamTasks.length} tasks`}
          </p>
          <Button
            variant="outline"
            className="ml-auto shrink-0 md:hidden"
            aria-expanded={filtersOpen}
            aria-controls="board-filters"
            onClick={() => setFiltersOpen((open) => !open)}
          >
            <SlidersHorizontal aria-hidden />
            Filters
            {activeFilters > 0 && (
              <span className="rounded bg-primary px-1 text-[10px] text-primary-foreground tabular-nums">
                {activeFilters}
              </span>
            )}
          </Button>
        </div>

        <div id="board-filters" className={cn(filtersOpen ? "block" : "hidden", "md:block")}>
          <TaskFilterBar
            filters={filters}
            onChange={setFilters}
            users={users}
            currentUserId={user.id}
          />
        </div>

        {!mayCreate && (
          <p className="text-xs text-muted-foreground">
            You can move tasks that are assigned to you. Open any card to see its details.
          </p>
        )}
      </div>

      {teamTasks.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No tasks yet."
          description={
            mayCreate
              ? `Create the first task${team === "all" ? "" : ` for the ${teamName}`} to get the board started.`
              : "Tasks will appear here once an admin creates them."
          }
          action={
            mayCreate && (
              <Button onClick={() => openCreate("todo")}>
                <Plus aria-hidden />
                Create Task
              </Button>
            )
          }
          className="flex-1"
        />
      ) : visibleTasks.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="No tasks match these filters"
          description="Try a different search or clear the filters to see every task on this board."
          action={
            <Button variant="outline" onClick={() => setFilters(DEFAULT_TASK_FILTERS)}>
              Clear filters
            </Button>
          }
          className="flex-1"
        />
      ) : (
        // `relative` keeps visually hidden (absolutely positioned) text inside this scroll area.
        <div className="relative min-h-0 flex-1 overflow-x-auto overflow-y-hidden p-3 sm:p-4 lg:px-6">
          <KanbanBoard
            tasks={visibleTasks}
            canMoveTask={(task) => canUpdateTaskStatus(user, task)}
            onOpenTask={setOpenTaskId}
            onMoveTask={(id, status, order) => void moveTask(id, status, order)}
            onAddTask={mayCreate ? openCreate : undefined}
          />
        </div>
      )}

      <TaskDetailSheet taskId={openTaskId} onClose={() => setOpenTaskId(null)} />

      {mayCreate && (
        <TaskFormDialog
          open={createStatus !== null}
          onOpenChange={(open) => {
            if (!open) setCreateStatus(null);
          }}
          defaults={{
            teamId: team === "all" ? undefined : team,
            status: createStatus ?? lastCreateStatus,
          }}
        />
      )}
    </>
  );
}

"use client";

import {
  ArrowRight,
  CalendarCheck,
  CircleAlert,
  CircleCheck,
  ListTodo,
  Timer,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { PageBody, PageHeader } from "@/components/layout/page-header";
import { DueDate, PriorityBadge, STATUS_DOT, TEAM_ICONS } from "@/components/shared/badges";
import { EmptyState } from "@/components/shared/empty-state";
import { StatCard } from "@/components/shared/stat-card";
import { TeamTabs, type TeamFilter } from "@/components/shared/team-tabs";
import { UserAvatar } from "@/components/shared/user-avatar";
import { TaskDetailSheet } from "@/components/tasks/task-detail-sheet";
import { STATUS_LABELS, TASK_STATUSES } from "@/lib/constants";
import { getAccessibleTeamIds, isAdmin } from "@/lib/permissions";
import {
  compareByDueDate,
  filterByTeam,
  matchesDueFilter,
  summarizeTasks,
} from "@/lib/task-filters";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/providers/auth-provider";
import { useData } from "@/providers/data-provider";

const UPCOMING_LIMIT = 6;

export function DashboardView() {
  const user = useCurrentUser();
  const { tasks, teams, getUser, getTeam } = useData();
  const admin = isAdmin(user);

  const allowedTeamIds = useMemo(() => getAccessibleTeamIds(user), [user]);
  const allowedTeams = useMemo(
    () => teams.filter((team) => allowedTeamIds.includes(team.id)),
    [teams, allowedTeamIds],
  );

  const [team, setTeam] = useState<TeamFilter>("all");
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  // Members only ever see numbers for the teams they belong to.
  const scoped = useMemo(
    () => filterByTeam(tasks, team, allowedTeamIds),
    [tasks, team, allowedTeamIds],
  );
  const summary = useMemo(() => summarizeTasks(scoped), [scoped]);

  const mine = useMemo(
    () =>
      tasks.filter(
        (task) =>
          task.assigneeId === user.id &&
          task.status !== "done" &&
          (team === "all" || task.teamId === team),
      ),
    [tasks, user.id, team],
  );
  const mineDueSoon = mine.filter((task) => matchesDueFilter(task, "week")).length;

  const breakdown = useMemo(
    () =>
      allowedTeams
        .filter((t) => team === "all" || t.id === team)
        .map((t) => ({ team: t, ...summarizeTasks(scoped.filter((task) => task.teamId === t.id)) })),
    [allowedTeams, team, scoped],
  );

  const upcoming = useMemo(
    () =>
      scoped
        .filter((task) => task.status !== "done" && task.dueDate)
        .sort(compareByDueDate)
        .slice(0, UPCOMING_LIMIT),
    [scoped],
  );

  const allLabel = admin ? "All Teams" : "My Teams";
  const scopeLabel =
    team === "all"
      ? allowedTeams.length === 1
        ? `${allowedTeams[0].name} Team`
        : allLabel
      : `${getTeam(team)?.name ?? ""} Team`;

  return (
    <>
      <PageHeader title="Dashboard" context={scopeLabel} />
      <PageBody>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              Welcome back, {user.name.split(" ")[0]}
            </h2>
            <p className="text-sm text-muted-foreground">
              {admin
                ? "Progress across the whole organization."
                : "Progress for the teams you belong to."}
            </p>
          </div>
          {allowedTeams.length > 1 && (
            <TeamTabs teams={allowedTeams} value={team} onChange={setTeam} allLabel={allLabel} />
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <StatCard
            label="Active tasks"
            value={summary.active}
            icon={ListTodo}
            hint={`${summary.todo} to do · ${summary.inReview} in review`}
          />
          <StatCard
            label="In progress"
            value={summary.inProgress}
            icon={Timer}
            hint="Being worked on now"
          />
          <StatCard
            label="Completed"
            value={summary.done}
            icon={CircleCheck}
            hint={
              summary.total > 0
                ? `${Math.round((summary.done / summary.total) * 100)}% of ${summary.total} tasks`
                : "No tasks yet"
            }
          />
          <StatCard
            label="Overdue"
            value={summary.overdue}
            icon={CircleAlert}
            tone={summary.overdue > 0 ? "alert" : "default"}
            hint={summary.overdue > 0 ? "Past the due date" : "Nothing overdue"}
          />
          <StatCard
            label="Assigned to me"
            value={mine.length}
            icon={UserRound}
            hint={mineDueSoon > 0 ? `${mineDueSoon} due in 7 days` : "Open tasks"}
            className="col-span-2 md:col-span-1"
          />
        </div>

        <div className="grid items-start gap-4 xl:grid-cols-5">
          <section
            aria-labelledby="team-status-heading"
            className="overflow-hidden rounded-xl border border-border bg-white xl:col-span-3"
          >
            <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
              <h2 id="team-status-heading" className="text-sm font-semibold text-foreground">
                Task status by team
              </h2>
              <Link
                href="/board"
                className="inline-flex items-center gap-1 rounded text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                Open board
                <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </div>

            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th scope="col" className="px-4 py-2 text-left font-medium">
                      Team
                    </th>
                    {TASK_STATUSES.map((status) => (
                      <th key={status} scope="col" className="px-2 py-2 text-right font-medium">
                        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                          <span className={cn("size-1.5 rounded-full", STATUS_DOT[status])} aria-hidden />
                          {STATUS_LABELS[status]}
                        </span>
                      </th>
                    ))}
                    <th scope="col" className="w-[30%] px-4 py-2 text-left font-medium">
                      Completed
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {breakdown.map((row) => {
                    const Icon = TEAM_ICONS[row.team.id];
                    const percent = row.total > 0 ? Math.round((row.done / row.total) * 100) : 0;
                    return (
                      <tr key={row.team.id} className="border-b border-border last:border-0">
                        <th scope="row" className="px-4 py-3 text-left font-medium text-foreground">
                          <span className="inline-flex items-center gap-2">
                            <Icon className="size-4 text-brand-slate" aria-hidden />
                            {row.team.name}
                          </span>
                        </th>
                        <td className="px-2 py-3 text-right tabular-nums">{row.todo}</td>
                        <td className="px-2 py-3 text-right tabular-nums">{row.inProgress}</td>
                        <td className="px-2 py-3 text-right tabular-nums">{row.inReview}</td>
                        <td className="px-2 py-3 text-right tabular-nums">{row.done}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div
                              role="progressbar"
                              aria-label={`${row.team.name} tasks completed`}
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-valuenow={percent}
                              className="h-1.5 min-w-16 flex-1 overflow-hidden rounded-full bg-secondary"
                            >
                              <div
                                className="h-full rounded-full bg-primary"
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                            <span className="w-9 text-right text-xs text-muted-foreground tabular-nums">
                              {percent}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section
            aria-labelledby="deadlines-heading"
            className="overflow-hidden rounded-xl border border-border bg-white xl:col-span-2"
          >
            <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
              <h2 id="deadlines-heading" className="text-sm font-semibold text-foreground">
                Upcoming deadlines
              </h2>
              <Link
                href="/my-tasks"
                className="inline-flex items-center gap-1 rounded text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                My tasks
                <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </div>

            {upcoming.length === 0 ? (
              <EmptyState
                icon={CalendarCheck}
                title="No upcoming deadlines"
                description="Open tasks with a due date will be listed here."
                className="py-10"
              />
            ) : (
              <ul className="divide-y divide-border">
                {upcoming.map((task) => (
                  <li key={task.id}>
                    <button
                      type="button"
                      onClick={() => setOpenTaskId(task.id)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-secondary/60 focus-visible:-outline-offset-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-foreground">
                          {task.title}
                        </p>
                        <p className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                          <span className="font-mono">{task.key}</span>
                          <span aria-hidden>·</span>
                          <DueDate task={task} verbose showIcon={false} className="text-[11px]" />
                        </p>
                      </div>
                      <PriorityBadge priority={task.priority} className="max-sm:hidden" />
                      <UserAvatar user={getUser(task.assigneeId)} size="sm" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </PageBody>

      <TaskDetailSheet taskId={openTaskId} onClose={() => setOpenTaskId(null)} />
    </>
  );
}

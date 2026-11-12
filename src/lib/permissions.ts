/**
 * Access rules for the two account roles (Admin, Member), used by the UI to
 * decide which controls to show.
 *
 * These are NOT the security boundary. The same rules are enforced in the
 * database by row level security policies and triggers
 * (supabase/migrations/*_initial_schema.sql). Keep the two in sync: if a rule
 * changes here, change the policy too.
 */

import { TEAM_IDS } from "@/lib/constants";
import type { Task, TeamId, User } from "@/types";

export function isAdmin(user: User): boolean {
  return user.role === "admin";
}

/** Teams whose Scrum boards the user may open. Admins can open all of them. */
export function getAccessibleTeamIds(user: User): TeamId[] {
  if (isAdmin(user)) return [...TEAM_IDS];
  return TEAM_IDS.filter((id) => user.teamIds.includes(id));
}

export function canViewTeam(user: User, teamId: TeamId): boolean {
  return isAdmin(user) || user.teamIds.includes(teamId);
}

/** Only admins get the combined "All Teams" board. */
export function canViewAllTeams(user: User): boolean {
  return isAdmin(user);
}

/**
 * A member can see a task when it belongs to one of their teams, or when it is
 * assigned to them (admins may assign across teams).
 */
export function canViewTask(user: User, task: Task): boolean {
  return canViewTeam(user, task.teamId) || task.assigneeId === user.id;
}

export function canCreateTask(user: User): boolean {
  return isAdmin(user);
}

/** Title, description, team, assignee, priority, due date, tags. */
export function canEditTask(user: User): boolean {
  return isAdmin(user);
}

export function canAssignTask(user: User): boolean {
  return isAdmin(user);
}

export function canDeleteTask(user: User): boolean {
  return isAdmin(user);
}

function isAssignee(user: User, task: Task): boolean {
  return task.assigneeId === user.id;
}

/** Covers the status dropdown and drag-and-drop between columns. */
export function canUpdateTaskStatus(user: User, task: Task): boolean {
  return isAdmin(user) || isAssignee(user, task);
}

/** Ticking items off and adding new ones. */
export function canUpdateChecklist(user: User, task: Task): boolean {
  return isAdmin(user) || isAssignee(user, task);
}

/** Removing checklist items changes the task's scope, so it is admin-only. */
export function canRemoveChecklistItem(user: User): boolean {
  return isAdmin(user);
}

export function canCommentOnTask(user: User, task: Task): boolean {
  return canViewTask(user, task);
}

/** Create, edit, and delete inventory entries. */
export function canManageInventory(user: User): boolean {
  return isAdmin(user);
}

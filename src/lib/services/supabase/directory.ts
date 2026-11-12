import { TEAM_IDS } from "@/lib/constants";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { DirectoryService } from "@/lib/services/types";
import type { TeamId } from "@/types";

import { toServiceError } from "./errors";
import { mapTeam, mapUser, PROFILE_SELECT, TEAM_SELECT, type ProfileRow, type TeamRow } from "./mappers";

export const supabaseDirectoryService: DirectoryService = {
  async listUsers() {
    const supabase = getSupabaseBrowserClient();
    const [profiles, memberships] = await Promise.all([
      supabase.from("profiles").select(PROFILE_SELECT).order("full_name"),
      // RLS returns everyone's memberships to admins, and only their own to members.
      supabase.from("team_members").select("user_id, team_id"),
    ]);
    if (profiles.error) throw toServiceError(profiles.error);
    if (memberships.error) throw toServiceError(memberships.error);

    const teamsByUser = new Map<string, TeamId[]>();
    for (const row of memberships.data ?? []) {
      const list = teamsByUser.get(row.user_id) ?? [];
      list.push(row.team_id as TeamId);
      teamsByUser.set(row.user_id, list);
    }

    return ((profiles.data ?? []) as ProfileRow[]).map((row) =>
      mapUser(
        row,
        (teamsByUser.get(row.id) ?? []).sort((a, b) => TEAM_IDS.indexOf(a) - TEAM_IDS.indexOf(b)),
      ),
    );
  },

  async listTeams() {
    const { data, error } = await getSupabaseBrowserClient().from("teams").select(TEAM_SELECT);
    if (error) throw toServiceError(error);
    return ((data ?? []) as TeamRow[])
      .map(mapTeam)
      .sort((a, b) => TEAM_IDS.indexOf(a.id) - TEAM_IDS.indexOf(b.id));
  },
};

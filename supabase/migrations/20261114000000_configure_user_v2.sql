-- =============================================================================
-- UB Lunabotics · simpler, safer private.configure_user()
--
-- Replaces the admin helper used from the Supabase SQL Editor to set a user's
-- display name, role, and teams:
--
--   select * from private.configure_user(
--     'student@buffalo.edu', 'Student Name', 'member', array['software', 'electrical']);
--
-- Changes from the version in 20261113000000_email_login.sql:
--   * No default arguments. Previously, omitting the role or teams silently
--     reset someone to 'member' with no teams.
--   * Role is validated with a clear message ('admin' or 'member', any case).
--   * Team names are case-insensitive, duplicates are ignored, and every
--     invalid name is reported by name.
--   * NULL means "leave unchanged" for name, role, or teams.
--   * Blank names are rejected instead of being saved as empty.
--   * profiles.email is no longer overwritten (a trigger keeps it in sync).
--   * Only writes when something actually changes, so re-running is a no-op.
--   * Runs with the caller's privileges (SECURITY INVOKER). Only the database
--     owner (the SQL Editor's `postgres` role) can execute it at all.
--
-- NON-DESTRUCTIVE: only the old function is replaced. No users, profiles,
-- roles, team memberships, tasks, or inventory are modified by this migration.
-- Safe to re-run.
-- =============================================================================

-- Old versions, by exact signature. Nothing in the app calls them.
drop function if exists private.configure_user(text, text, text, public.app_role, text[]);  -- username era
drop function if exists private.configure_user(text, text, public.app_role, text[]);        -- email-login migration

create or replace function private.configure_user(
  p_email     text,    -- email of an EXISTING Supabase Auth user (case-insensitive)
  p_full_name text,    -- display name; NULL = keep the current name
  p_role      text,    -- 'admin' or 'member'; NULL = keep the current role
  p_team_ids  text[]   -- replaces all memberships; '{}' = no teams; NULL = keep current teams
)
returns table (user_id uuid, email text, full_name text, role public.app_role, team_ids text[])
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_email       text := lower(btrim(coalesce(p_email, '')));
  v_matches     integer;
  v_user_id     uuid;
  v_auth_email  text;
  v_name        text;
  v_role        public.app_role;
  v_teams       text[];
  v_invalid     text[];
  v_valid_list  text;
begin
  -- ---------------------------------------------------------------- validate
  if v_email = '' then
    raise exception 'An email address is required.';
  end if;

  select count(*) into v_matches from auth.users au where lower(au.email) = v_email;
  if v_matches = 0 then
    raise exception 'No Supabase Auth user has the email "%".', btrim(p_email)
      using hint = 'Create or invite the user first: Dashboard -> Authentication -> Users -> Add user.';
  elsif v_matches > 1 then
    raise exception 'More than one Auth user matches "%". Resolve the duplicate in Authentication -> Users.', btrim(p_email);
  end if;
  select au.id, au.email into v_user_id, v_auth_email from auth.users au where lower(au.email) = v_email;

  if p_full_name is not null then
    v_name := btrim(p_full_name);
    if v_name = '' then
      raise exception 'The full name cannot be blank. Pass NULL to keep the current name.';
    elsif char_length(v_name) > 120 then
      raise exception 'The full name must be 120 characters or fewer.';
    end if;
  end if;

  if p_role is not null then
    if lower(btrim(p_role)) not in ('admin', 'member') then
      raise exception 'Invalid role "%". Use ''admin'' or ''member''.', p_role;
    end if;
    v_role := lower(btrim(p_role))::public.app_role;
  end if;

  if p_team_ids is not null then
    select string_agg(t.id, ', ' order by t.id) into v_valid_list from public.teams t;

    select coalesce(array_agg(distinct x.raw order by x.raw), '{}')
      into v_invalid
      from (select coalesce(nullif(btrim(lower(tid)), ''), '(blank)') as raw
              from unnest(p_team_ids) as u(tid)) x
     where not exists (select 1 from public.teams t where t.id = x.raw);
    if cardinality(v_invalid) > 0 then
      raise exception 'Unknown team(s): %. Valid teams: %.', array_to_string(v_invalid, ', '), v_valid_list;
    end if;

    select coalesce(array_agg(distinct lower(btrim(tid)) order by lower(btrim(tid))), '{}')
      into v_teams
      from unnest(p_team_ids) as u(tid);
  end if;

  -- ---------------------------------------------------------------- apply
  -- Everything below runs inside this single function call, so it is atomic:
  -- any error rolls back the profile and membership changes together.

  -- Create the profile if it is somehow missing; otherwise update only what
  -- changed (so updated_at moves only on a real change).
  insert into public.profiles as p (id, full_name, email, role)
  values (
    v_user_id,
    coalesce(v_name, split_part(v_auth_email, '@', 1)),
    v_auth_email,
    coalesce(v_role, 'member')
  )
  on conflict (id) do update
    set full_name = coalesce(v_name, p.full_name),
        role      = coalesce(v_role, p.role)
    where p.full_name is distinct from coalesce(v_name, p.full_name)
       or p.role      is distinct from coalesce(v_role, p.role);

  if v_teams is not null then
    delete from public.team_members tm
     where tm.user_id = v_user_id
       and not (tm.team_id = any (v_teams));

    -- Conflict target named by constraint: `user_id` would be ambiguous with
    -- this function's output column of the same name.
    insert into public.team_members (user_id, team_id)
    select v_user_id, t from unnest(v_teams) as t
    on conflict on constraint team_members_pkey do nothing;
  end if;

  return query
    select p.id, p.email, p.full_name, p.role,
           coalesce(array_agg(tm.team_id order by tm.team_id)
                      filter (where tm.team_id is not null), '{}')
      from public.profiles p
      left join public.team_members tm on tm.user_id = p.id
     where p.id = v_user_id
     group by p.id;
end;
$$;

comment on function private.configure_user(text, text, text, text[]) is
  'Admin-only (SQL Editor). Sets an existing Auth user''s display name, role, and teams. '
  'NULL leaves a field unchanged; the team array replaces all memberships.';

-- Only the owner (postgres, i.e. the SQL Editor) may run it. Revoke the
-- default PUBLIC grant and make sure no API role has it.
revoke all on function private.configure_user(text, text, text, text[])
  from public, anon, authenticated, service_role;

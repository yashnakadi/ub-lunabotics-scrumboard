-- =============================================================================
-- UB Lunabotics · switch to email login + security hardening
--
-- Login now uses Supabase Auth's native email/password sign-in, so the
-- username-to-email lookup and the rules that made usernames mandatory are
-- removed.
--
-- NON-DESTRUCTIVE: no rows are deleted and no columns are dropped. Auth
-- accounts, passwords, profiles, roles, team memberships, tasks, and
-- inventory are untouched. The `profiles.username` column is kept (now
-- optional and hidden from app users); see the optional step at the end.
--
-- Safe to re-run.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Remove the username login lookup (it was only callable with the secret key)
-- -----------------------------------------------------------------------------
drop function if exists public.get_login_email(text);

-- -----------------------------------------------------------------------------
-- 2. Keep everyone's display name: if a profile has no full name, use the
--    username it had before usernames stop being shown.
-- -----------------------------------------------------------------------------
update public.profiles
   set full_name = left(username, 120)
 where btrim(full_name) = '' and username is not null;

-- -----------------------------------------------------------------------------
-- 3. Usernames are no longer required, unique, or validated
-- -----------------------------------------------------------------------------
drop index if exists public.profiles_username_lower_key;
alter table public.profiles drop constraint if exists profiles_username_check;
alter table public.profiles alter column username drop not null;

-- App users no longer need to read it.
revoke select (username) on public.profiles from authenticated;

comment on column public.profiles.username is
  'Unused since the switch to email login (20261113000000). Safe to drop.';

-- -----------------------------------------------------------------------------
-- 4. New Auth users: profile gets a display name instead of a username
-- -----------------------------------------------------------------------------
create or replace function private.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  -- The role is ALWAYS 'member'. Never read a role from user metadata: it can be
  -- supplied by whoever creates the account. Admins are promoted explicitly.
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    left(coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      split_part(coalesce(new.email, ''), '@', 1)
    ), 120),
    new.email,
    'member'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public;

-- No longer used by anything.
drop function if exists private.derive_username(text, text);

-- -----------------------------------------------------------------------------
-- 5. Administration helper without usernames (SQL Editor only)
--
--   select * from private.configure_user('jdoe@buffalo.edu', 'Jane Doe', 'member',
--                                        array['software', 'electrical']);
--
-- Team assignments are REPLACED by the given list.
-- -----------------------------------------------------------------------------
drop function if exists private.configure_user(text, text, text, public.app_role, text[]);

create or replace function private.configure_user(
  p_email     text,
  p_full_name text,
  p_role      public.app_role default 'member',
  p_team_ids  text[] default '{}'
)
returns table (user_id uuid, email text, full_name text, role public.app_role, team_ids text[])
language plpgsql security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select u.id into v_id from auth.users u where lower(u.email) = lower(btrim(p_email));
  if v_id is null then
    raise exception 'No Supabase Auth user has the email "%". Create or invite the user first.', p_email;
  end if;

  if exists (
    select 1 from unnest(coalesce(p_team_ids, '{}')) as t(team_id)
    where not exists (select 1 from public.teams tm where tm.id = t.team_id)
  ) then
    raise exception 'Unknown team in %. Valid teams: software, electrical, mechanical.', p_team_ids;
  end if;

  insert into public.profiles as p (id, full_name, email, role)
  select v_id, left(btrim(coalesce(p_full_name, '')), 120), u.email, p_role
  from auth.users u where u.id = v_id
  on conflict (id) do update
    set full_name = excluded.full_name,
        email     = excluded.email,
        role      = excluded.role;

  delete from public.team_members tm
   where tm.user_id = v_id and not (tm.team_id = any (coalesce(p_team_ids, '{}')));

  insert into public.team_members (user_id, team_id)
  select v_id, t.team_id from unnest(coalesce(p_team_ids, '{}')) as t(team_id)
  on conflict do nothing;

  return query
    select p.id, p.email, p.full_name, p.role,
           coalesce(array_agg(tm.team_id order by tm.team_id) filter (where tm.team_id is not null), '{}')
    from public.profiles p
    left join public.team_members tm on tm.user_id = p.id
    where p.id = v_id
    group by p.id;
end;
$$;

revoke all on function private.configure_user(text, text, public.app_role, text[])
  from public, anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 6. Hardening: signed-in users can no longer execute the task-number counter
--
-- Previously `authenticated` had EXECUTE on private.next_task_number() so the
-- (SECURITY INVOKER) task trigger could call it. If GraphQL (pg_graphql)
-- reflects the `private` schema, that grant would let any signed-in user call
-- it directly and burn task numbers. The trigger now runs as its owner
-- instead, so the grant can be removed. Behavior is otherwise unchanged:
-- auth.uid() still identifies the requesting user inside the trigger.
-- -----------------------------------------------------------------------------
alter function private.tasks_before_write() security definer;
alter function private.tasks_before_write() set search_path = '';
revoke all on function private.next_task_number(text) from public, anon, authenticated;
revoke all on function private.tasks_before_write() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 7. Fix: let the server-only secret key (service_role) write to tables
--
-- Several guard triggers run as the caller and call helpers in `private`.
-- Migration 1 granted that schema only to `authenticated`, so writes made with
-- the secret key (e.g. server scripts, the Admin API, or supabase-js using
-- SUPABASE_SECRET_KEY) failed with "permission denied for schema private".
-- The SQL Editor was unaffected because it runs as the schema owner.
-- -----------------------------------------------------------------------------
grant usage on schema private to service_role;
grant execute on function private.is_admin() to service_role;
grant execute on function private.is_team_member(text) to service_role;
grant execute on function private.can_view_task(uuid) to service_role;
grant execute on function private.is_task_assignee(uuid) to service_role;
grant execute on function private.is_end_user_request() to service_role;

-- -----------------------------------------------------------------------------
-- 8. Hardening: bound the total size of task tags (each tag was unbounded)
-- -----------------------------------------------------------------------------
do $$ begin
  alter table public.tasks
    add constraint tasks_tags_length_check
    check (char_length(array_to_string(tags, ',')) <= 600);
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- OPTIONAL, DESTRUCTIVE (not run by this migration)
--
-- The username column is unused. Removing it permanently deletes the stored
-- usernames (nothing in the app or database depends on them). Run this
-- yourself in the SQL Editor if you want it gone:
--
--   alter table public.profiles drop column username;
-- -----------------------------------------------------------------------------

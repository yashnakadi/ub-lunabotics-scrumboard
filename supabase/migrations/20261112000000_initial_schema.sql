-- =============================================================================
-- UB Lunabotics · initial schema
--
-- Creates the application tables, row level security, triggers, and helper
-- functions. Seeds only the three engineering teams.
--
-- Safe to re-run: every object is created with IF NOT EXISTS / OR REPLACE, and
-- policies are dropped-then-recreated by name. Nothing here deletes data.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Schemas
-- -----------------------------------------------------------------------------

-- `private` holds helper functions. It is NOT exposed through the Data API, so
-- nothing in it can be called directly from the browser.
create schema if not exists private;
revoke all on schema private from public;
-- RLS policies run as the requesting role, which needs USAGE to call helpers.
grant usage on schema private to authenticated;

-- -----------------------------------------------------------------------------
-- Enum types
-- -----------------------------------------------------------------------------

do $$ begin
  create type public.app_role as enum ('admin', 'member');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.task_status as enum ('todo', 'in_progress', 'in_review', 'done');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.task_priority as enum ('low', 'medium', 'high', 'urgent');
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------

create table if not exists public.teams (
  id               text primary key check (id ~ '^[a-z][a-z0-9_-]{1,31}$'),
  name             text not null unique check (char_length(name) between 1 and 60),
  -- Prefix for task keys, e.g. SW -> SW-001.
  task_prefix      text not null unique check (task_prefix ~ '^[A-Z]{2,4}$'),
  -- Next number handed out to a task in this team. Incremented under a row
  -- lock by private.next_task_number(), so numbers are never duplicated.
  next_task_number integer not null default 1 check (next_task_number > 0),
  created_at       timestamptz not null default now()
);

create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  username   text not null check (username ~ '^[A-Za-z0-9][A-Za-z0-9._-]{2,31}$'),
  full_name  text not null default '' check (char_length(full_name) <= 120),
  -- Mirror of auth.users.email for administration. Never readable by
  -- ordinary signed-in users (see column grants below).
  email      text,
  role       public.app_role not null default 'member',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Usernames are unique regardless of case.
create unique index if not exists profiles_username_lower_key on public.profiles (lower(username));
create index if not exists profiles_email_lower_idx on public.profiles (lower(email));

create table if not exists public.team_members (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  team_id    text not null references public.teams (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, team_id)
);
create index if not exists team_members_team_id_idx on public.team_members (team_id);

create table if not exists public.tasks (
  id          uuid primary key default gen_random_uuid(),
  team_id     text not null references public.teams (id) on delete restrict,
  -- Assigned by trigger; unique per team. Displayed as <prefix>-<number>.
  task_number integer not null,
  title       text not null check (char_length(btrim(title)) between 3 and 200),
  description text not null default '' check (char_length(description) <= 10000),
  assigned_to uuid references public.profiles (id) on delete set null,
  created_by  uuid references public.profiles (id) on delete set null,
  status      public.task_status not null default 'todo',
  priority    public.task_priority not null default 'medium',
  due_date    date,
  tags        text[] not null default '{}' check (cardinality(tags) <= 20),
  -- Position within a Kanban column (ascending).
  sort_order  double precision not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint tasks_team_task_number_key unique (team_id, task_number)
);
create index if not exists tasks_team_status_idx on public.tasks (team_id, status);
create index if not exists tasks_assigned_to_idx on public.tasks (assigned_to);
create index if not exists tasks_created_by_idx on public.tasks (created_by);
create index if not exists tasks_due_date_idx on public.tasks (due_date) where status <> 'done';

create table if not exists public.task_checklist_items (
  id           uuid primary key default gen_random_uuid(),
  task_id      uuid not null references public.tasks (id) on delete cascade,
  content      text not null check (char_length(btrim(content)) between 1 and 500),
  is_completed boolean not null default false,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists task_checklist_items_task_id_idx on public.task_checklist_items (task_id, sort_order);

create table if not exists public.task_comments (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.tasks (id) on delete cascade,
  author_id  uuid references public.profiles (id) on delete set null,
  content    text not null check (char_length(btrim(content)) between 1 and 5000),
  created_at timestamptz not null default now()
);
create index if not exists task_comments_task_id_idx on public.task_comments (task_id, created_at);
create index if not exists task_comments_author_id_idx on public.task_comments (author_id);

-- Written only by triggers on public.tasks, never directly by clients.
create table if not exists public.task_activity (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.tasks (id) on delete cascade,
  actor_id   uuid references public.profiles (id) on delete set null,
  action     text not null check (action in (
               'created', 'status_changed', 'assignee_changed', 'priority_changed',
               'due_date_changed', 'team_changed', 'details_edited')),
  details    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists task_activity_task_id_idx on public.task_activity (task_id, created_at);
create index if not exists task_activity_actor_id_idx on public.task_activity (actor_id);

create table if not exists public.inventory (
  id                  uuid primary key default gen_random_uuid(),
  -- Human-readable number, displayed as INV-0001.
  item_number         bigint generated always as identity unique,
  item_name           text not null check (char_length(btrim(item_name)) between 1 and 200),
  category            text not null check (category in (
                        'Computing', 'Electrical', 'Mechanical', 'Sensors', 'Tools', 'Miscellaneous')),
  description         text not null default '' check (char_length(description) <= 2000),
  quantity            integer not null default 0 check (quantity >= 0),
  -- Flag the item as low stock when quantity <= this value. 0 disables it.
  low_stock_threshold integer not null default 0 check (low_stock_threshold >= 0),
  storage_location    text not null check (char_length(btrim(storage_location)) between 1 and 200),
  condition           text not null default 'Good' check (condition in (
                        'New', 'Good', 'Fair', 'Needs Repair', 'Out of Service')),
  -- NULL means the item is shared by the whole organization.
  team_id             text references public.teams (id) on delete set null,
  image_url           text check (image_url is null or (image_url ~* '^https?://' and char_length(image_url) <= 2000)),
  notes               text check (notes is null or char_length(notes) <= 4000),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists inventory_team_id_idx on public.inventory (team_id);
create index if not exists inventory_category_idx on public.inventory (category);

-- -----------------------------------------------------------------------------
-- Seed: the three engineering teams (and nothing else)
-- -----------------------------------------------------------------------------

insert into public.teams (id, name, task_prefix) values
  ('software',   'Software',   'SW'),
  ('electrical', 'Electrical', 'EL'),
  ('mechanical', 'Mechanical', 'ME')
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- Authorization helpers
--
-- SECURITY DEFINER so they can read profiles/team_members/tasks without
-- recursing through those tables' own RLS policies. Each one only answers a
-- yes/no question about the *calling* user (auth.uid()).
-- -----------------------------------------------------------------------------

create or replace function private.is_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

create or replace function private.is_team_member(p_team_id text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.team_members
    where user_id = (select auth.uid()) and team_id = p_team_id
  );
$$;

create or replace function private.can_view_task(p_task_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.tasks t
    where t.id = p_task_id
      and (
        private.is_admin()
        or t.assigned_to = (select auth.uid())
        or private.is_team_member(t.team_id)
      )
  );
$$;

create or replace function private.is_task_assignee(p_task_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.tasks
    where id = p_task_id and assigned_to = (select auth.uid())
  );
$$;

-- True for requests made by a signed-in end user through the Data API.
-- False for the SQL Editor, migrations, and the server-only secret key, which
-- are trusted administrative contexts.
create or replace function private.is_end_user_request()
returns boolean
language sql stable
set search_path = ''
as $$
  select (select auth.uid()) is not null;
$$;

revoke all on function private.is_admin() from public;
revoke all on function private.is_team_member(text) from public;
revoke all on function private.can_view_task(uuid) from public;
revoke all on function private.is_task_assignee(uuid) from public;
revoke all on function private.is_end_user_request() from public;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.is_team_member(text) to authenticated;
grant execute on function private.can_view_task(uuid) to authenticated;
grant execute on function private.is_task_assignee(uuid) to authenticated;
grant execute on function private.is_end_user_request() to authenticated;

-- -----------------------------------------------------------------------------
-- Generic triggers
-- -----------------------------------------------------------------------------

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

-- (inventory.updated_at is maintained by private.inventory_guard below.)
drop trigger if exists inventory_set_updated_at on public.inventory;

-- Inventory: IDs and creation time are immutable.
create or replace function private.inventory_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
  else
    new.id := old.id;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists inventory_guard on public.inventory;
create trigger inventory_guard
  before insert or update on public.inventory
  for each row execute function private.inventory_guard();

-- -----------------------------------------------------------------------------
-- Profiles: created automatically for every new Auth user
-- -----------------------------------------------------------------------------

-- Builds a valid, unused username from a preferred value (or the email's local
-- part). Admins normally set the real username afterwards.
create or replace function private.derive_username(p_preferred text, p_email text)
returns text
language plpgsql stable security definer
set search_path = ''
as $$
declare
  base      text;
  candidate text;
  n         integer := 0;
begin
  base := lower(coalesce(nullif(btrim(p_preferred), ''), split_part(coalesce(p_email, ''), '@', 1)));
  base := regexp_replace(base, '[^a-z0-9._-]', '', 'g');
  base := regexp_replace(base, '^[^a-z0-9]+', '');
  if char_length(base) < 3 then
    base := 'user';
  end if;
  base := left(base, 28);

  loop
    candidate := case when n = 0 then base else base || n::text end;
    exit when not exists (
      select 1 from public.profiles where lower(username) = candidate
    );
    n := n + 1;
  end loop;
  return candidate;
end;
$$;

revoke all on function private.derive_username(text, text) from public;

create or replace function private.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  -- The role is ALWAYS 'member'. Never read a role from user metadata: it can be
  -- supplied by whoever creates the account. Admins are promoted explicitly.
  insert into public.profiles (id, username, full_name, email, role)
  values (
    new.id,
    private.derive_username(new.raw_user_meta_data ->> 'username', new.email),
    left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120),
    new.email,
    'member'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Keep profiles.email in sync when an Auth user's email changes.
create or replace function private.handle_user_email_change()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

revoke all on function private.handle_user_email_change() from public;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function private.handle_user_email_change();

-- Profiles: only trusted contexts may change role. (End users have no UPDATE
-- grant on profiles at all; this is defense in depth.)
create or replace function private.profiles_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if private.is_end_user_request() then
    raise exception 'Profiles can only be changed by an administrator in Supabase.'
      using errcode = '42501';
  end if;
  new.id := old.id;
  new.created_at := old.created_at;
  return new;
end;
$$;

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard
  before update on public.profiles
  for each row execute function private.profiles_guard();

-- Backfill profiles for any Auth users that existed before this migration.
-- One row at a time so each generated username sees the ones before it.
do $$
declare
  u record;
begin
  for u in
    select au.id, au.email, au.raw_user_meta_data
    from auth.users au
    where not exists (select 1 from public.profiles p where p.id = au.id)
    order by au.created_at
  loop
    insert into public.profiles (id, username, full_name, email, role)
    values (
      u.id,
      private.derive_username(u.raw_user_meta_data ->> 'username', u.email),
      left(coalesce(u.raw_user_meta_data ->> 'full_name', ''), 120),
      u.email,
      'member'
    );
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- Tasks: numbering, field restrictions, activity log
-- -----------------------------------------------------------------------------

-- Hands out the next number for a team. The UPDATE takes a row lock on the
-- team, so concurrent inserts are serialized and can never share a number.
create or replace function private.next_task_number(p_team_id text)
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_number integer;
begin
  update public.teams
     set next_task_number = next_task_number + 1
   where id = p_team_id
  returning next_task_number - 1 into v_number;

  if v_number is null then
    raise exception 'Unknown team "%".', p_team_id using errcode = '23503';
  end if;
  return v_number;
end;
$$;

revoke all on function private.next_task_number(text) from public;
grant execute on function private.next_task_number(text) to authenticated;

create or replace function private.tasks_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.task_number := private.next_task_number(new.team_id);
    new.created_at := now();
    if private.is_end_user_request() then
      new.created_by := (select auth.uid());
    end if;
  else
    -- Immutable fields.
    new.id := old.id;
    new.created_by := old.created_by;
    new.created_at := old.created_at;

    -- Members (the task's assignee) may only move the task: status and position.
    if private.is_end_user_request() and not private.is_admin() then
      if new.title       is distinct from old.title
      or new.description is distinct from old.description
      or new.team_id     is distinct from old.team_id
      or new.assigned_to is distinct from old.assigned_to
      or new.priority    is distinct from old.priority
      or new.due_date    is distinct from old.due_date
      or new.tags        is distinct from old.tags
      or new.task_number is distinct from old.task_number then
        raise exception 'Only admins can change these task fields.' using errcode = '42501';
      end if;
    end if;

    -- Moving to another team gives the task a number in that team.
    if new.team_id is distinct from old.team_id then
      new.task_number := private.next_task_number(new.team_id);
    else
      new.task_number := old.task_number;
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists tasks_before_write on public.tasks;
create trigger tasks_before_write
  before insert or update on public.tasks
  for each row execute function private.tasks_before_write();

create or replace function private.task_key(p_team_id text, p_number integer)
returns text
language sql stable security definer
set search_path = ''
as $$
  select t.task_prefix || '-' || lpad(p_number::text, 3, '0')
  from public.teams t where t.id = p_team_id;
$$;

revoke all on function private.task_key(text, integer) from public;

-- Records task history. SECURITY DEFINER because clients have no INSERT grant
-- on task_activity: history can only be written by this trigger.
create or replace function private.tasks_log_activity()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if tg_op = 'INSERT' then
    insert into public.task_activity (task_id, actor_id, action)
    values (new.id, v_actor, 'created');
    return new;
  end if;

  if new.status is distinct from old.status then
    insert into public.task_activity (task_id, actor_id, action, details)
    values (new.id, v_actor, 'status_changed',
            jsonb_build_object('from', old.status, 'to', new.status));
  end if;

  if new.assigned_to is distinct from old.assigned_to then
    insert into public.task_activity (task_id, actor_id, action, details)
    values (new.id, v_actor, 'assignee_changed',
            jsonb_build_object('from', old.assigned_to, 'to', new.assigned_to));
  end if;

  if new.priority is distinct from old.priority then
    insert into public.task_activity (task_id, actor_id, action, details)
    values (new.id, v_actor, 'priority_changed',
            jsonb_build_object('from', old.priority, 'to', new.priority));
  end if;

  if new.due_date is distinct from old.due_date then
    insert into public.task_activity (task_id, actor_id, action, details)
    values (new.id, v_actor, 'due_date_changed',
            jsonb_build_object('from', old.due_date, 'to', new.due_date));
  end if;

  if new.team_id is distinct from old.team_id then
    insert into public.task_activity (task_id, actor_id, action, details)
    values (new.id, v_actor, 'team_changed', jsonb_build_object(
      'from', old.team_id,
      'to', new.team_id,
      'from_key', private.task_key(old.team_id, old.task_number),
      'to_key', private.task_key(new.team_id, new.task_number)));
  end if;

  if new.title is distinct from old.title
  or new.description is distinct from old.description
  or new.tags is distinct from old.tags then
    insert into public.task_activity (task_id, actor_id, action)
    values (new.id, v_actor, 'details_edited');
  end if;

  return new;
end;
$$;

revoke all on function private.tasks_log_activity() from public;

drop trigger if exists tasks_log_activity on public.tasks;
create trigger tasks_log_activity
  after insert or update on public.tasks
  for each row execute function private.tasks_log_activity();

-- -----------------------------------------------------------------------------
-- Checklist and comment guards
-- -----------------------------------------------------------------------------

create or replace function private.checklist_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    return new;
  end if;

  new.id := old.id;
  new.task_id := old.task_id;
  new.created_at := old.created_at;

  -- Assignees may tick items off, but only admins can reword or reorder them.
  if private.is_end_user_request() and not private.is_admin() then
    if new.content is distinct from old.content
    or new.sort_order is distinct from old.sort_order then
      raise exception 'Only admins can edit checklist items.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists checklist_before_write on public.task_checklist_items;
create trigger checklist_before_write
  before insert or update on public.task_checklist_items
  for each row execute function private.checklist_before_write();

create or replace function private.comments_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Comments are always attributed to the person posting them.
  if private.is_end_user_request() then
    new.author_id := (select auth.uid());
  end if;
  new.created_at := now();
  return new;
end;
$$;

drop trigger if exists comments_before_insert on public.task_comments;
create trigger comments_before_insert
  before insert on public.task_comments
  for each row execute function private.comments_before_insert();

-- -----------------------------------------------------------------------------
-- Username login support
--
-- Resolves a username to the Auth email so the server can call Supabase Auth.
-- Callable ONLY with the server-only secret key (service_role). It is not
-- available to anonymous or signed-in browser clients.
-- -----------------------------------------------------------------------------

create or replace function public.get_login_email(p_username text)
returns text
language sql stable security definer
set search_path = ''
as $$
  select u.email
  from public.profiles p
  join auth.users u on u.id = p.id
  where lower(p.username) = lower(btrim(p_username))
  limit 1;
$$;

revoke all on function public.get_login_email(text) from public, anon, authenticated;
grant execute on function public.get_login_email(text) to service_role;

-- -----------------------------------------------------------------------------
-- Administration helper (SQL Editor only)
--
-- Sets a user's username, name, role, and teams in one call, e.g.
--   select private.configure_user('jdoe@buffalo.edu', 'jdoe', 'Jane Doe', 'member',
--                                 array['software', 'electrical']);
-- Team assignments are REPLACED by the given list.
-- Not executable by any API role; run it from the Supabase SQL Editor.
-- -----------------------------------------------------------------------------

create or replace function private.configure_user(
  p_email     text,
  p_username  text,
  p_full_name text,
  p_role      public.app_role default 'member',
  p_team_ids  text[] default '{}'
)
returns table (user_id uuid, username text, full_name text, role public.app_role, team_ids text[])
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
    select 1 from public.profiles p
    where lower(p.username) = lower(btrim(p_username)) and p.id <> v_id
  ) then
    raise exception 'The username "%" is already taken.', p_username;
  end if;

  if exists (
    select 1 from unnest(coalesce(p_team_ids, '{}')) as t(team_id)
    where not exists (select 1 from public.teams tm where tm.id = t.team_id)
  ) then
    raise exception 'Unknown team in %. Valid teams: software, electrical, mechanical.', p_team_ids;
  end if;

  insert into public.profiles as p (id, username, full_name, email, role)
  select v_id, btrim(p_username), btrim(coalesce(p_full_name, '')), u.email, p_role
  from auth.users u where u.id = v_id
  on conflict (id) do update
    set username  = excluded.username,
        full_name = excluded.full_name,
        email     = excluded.email,
        role      = excluded.role;

  delete from public.team_members tm
   where tm.user_id = v_id and not (tm.team_id = any (coalesce(p_team_ids, '{}')));

  insert into public.team_members (user_id, team_id)
  select v_id, t.team_id from unnest(coalesce(p_team_ids, '{}')) as t(team_id)
  on conflict do nothing;

  return query
    select p.id, p.username, p.full_name, p.role,
           coalesce(array_agg(tm.team_id order by tm.team_id) filter (where tm.team_id is not null), '{}')
    from public.profiles p
    left join public.team_members tm on tm.user_id = p.id
    where p.id = v_id
    group by p.id;
end;
$$;

revoke all on function private.configure_user(text, text, text, public.app_role, text[])
  from public, anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Privileges
--
-- Supabase grants broad table privileges to the API roles by default. Reset
-- them, then grant only what the app needs. RLS (below) then limits rows.
-- -----------------------------------------------------------------------------

revoke all on public.teams, public.profiles, public.team_members, public.tasks,
  public.task_checklist_items, public.task_comments, public.task_activity, public.inventory
  from anon, authenticated;

-- Anonymous visitors get nothing. Signed-in users:
grant select (id, name, task_prefix, created_at) on public.teams to authenticated;

-- Email is deliberately NOT readable by end users.
grant select (id, username, full_name, role, created_at, updated_at) on public.profiles to authenticated;

grant select on public.team_members to authenticated;

grant select, delete on public.tasks to authenticated;
grant insert (team_id, title, description, assigned_to, status, priority, due_date, tags, sort_order)
  on public.tasks to authenticated;
grant update (team_id, title, description, assigned_to, status, priority, due_date, tags, sort_order)
  on public.tasks to authenticated;

grant select, delete on public.task_checklist_items to authenticated;
grant insert (task_id, content, is_completed, sort_order) on public.task_checklist_items to authenticated;
grant update (content, is_completed, sort_order) on public.task_checklist_items to authenticated;

grant select on public.task_comments to authenticated;
grant insert (task_id, content) on public.task_comments to authenticated;

grant select on public.task_activity to authenticated;

grant select, delete on public.inventory to authenticated;
grant insert (item_name, category, description, quantity, low_stock_threshold, storage_location,
              condition, team_id, image_url, notes) on public.inventory to authenticated;
grant update (item_name, category, description, quantity, low_stock_threshold, storage_location,
              condition, team_id, image_url, notes) on public.inventory to authenticated;

-- -----------------------------------------------------------------------------
-- Row level security
-- -----------------------------------------------------------------------------

alter table public.teams                enable row level security;
alter table public.profiles             enable row level security;
alter table public.team_members         enable row level security;
alter table public.tasks                enable row level security;
alter table public.task_checklist_items enable row level security;
alter table public.task_comments        enable row level security;
alter table public.task_activity        enable row level security;
alter table public.inventory            enable row level security;

-- teams: readable by every signed-in user; no client writes.
drop policy if exists "Signed-in users can read teams" on public.teams;
create policy "Signed-in users can read teams"
  on public.teams for select to authenticated
  using (true);

-- profiles: names and roles are visible to teammates (for assignee pickers).
-- No client inserts/updates/deletes: profiles are created by trigger and
-- managed by administrators in Supabase.
drop policy if exists "Signed-in users can read profiles" on public.profiles;
create policy "Signed-in users can read profiles"
  on public.profiles for select to authenticated
  using (true);

-- team_members: users see their own memberships; admins see everyone's.
-- No client writes, so nobody can add themselves to a team.
drop policy if exists "Users read own memberships, admins read all" on public.team_members;
create policy "Users read own memberships, admins read all"
  on public.team_members for select to authenticated
  using (user_id = (select auth.uid()) or private.is_admin());

-- tasks
drop policy if exists "Read tasks on own teams or assigned to self" on public.tasks;
create policy "Read tasks on own teams or assigned to self"
  on public.tasks for select to authenticated
  using (
    private.is_admin()
    or assigned_to = (select auth.uid())
    or private.is_team_member(team_id)
  );

drop policy if exists "Admins create tasks" on public.tasks;
create policy "Admins create tasks"
  on public.tasks for insert to authenticated
  with check (private.is_admin());

-- Assignees may update their own task; the trigger limits them to status and
-- position. Admins may update anything.
drop policy if exists "Admins and assignees update tasks" on public.tasks;
create policy "Admins and assignees update tasks"
  on public.tasks for update to authenticated
  using (private.is_admin() or assigned_to = (select auth.uid()))
  with check (private.is_admin() or assigned_to = (select auth.uid()));

drop policy if exists "Admins delete tasks" on public.tasks;
create policy "Admins delete tasks"
  on public.tasks for delete to authenticated
  using (private.is_admin());

-- task_checklist_items
drop policy if exists "Read checklist of visible tasks" on public.task_checklist_items;
create policy "Read checklist of visible tasks"
  on public.task_checklist_items for select to authenticated
  using (private.can_view_task(task_id));

drop policy if exists "Admins and assignees add checklist items" on public.task_checklist_items;
create policy "Admins and assignees add checklist items"
  on public.task_checklist_items for insert to authenticated
  with check (private.is_admin() or private.is_task_assignee(task_id));

drop policy if exists "Admins and assignees update checklist items" on public.task_checklist_items;
create policy "Admins and assignees update checklist items"
  on public.task_checklist_items for update to authenticated
  using (private.is_admin() or private.is_task_assignee(task_id))
  with check (private.is_admin() or private.is_task_assignee(task_id));

drop policy if exists "Admins delete checklist items" on public.task_checklist_items;
create policy "Admins delete checklist items"
  on public.task_checklist_items for delete to authenticated
  using (private.is_admin());

-- task_comments: anyone who can see the task can comment, as themselves.
drop policy if exists "Read comments on visible tasks" on public.task_comments;
create policy "Read comments on visible tasks"
  on public.task_comments for select to authenticated
  using (private.can_view_task(task_id));

drop policy if exists "Comment on visible tasks as self" on public.task_comments;
create policy "Comment on visible tasks as self"
  on public.task_comments for insert to authenticated
  with check (author_id = (select auth.uid()) and private.can_view_task(task_id));

-- task_activity: read-only for clients.
drop policy if exists "Read activity on visible tasks" on public.task_activity;
create policy "Read activity on visible tasks"
  on public.task_activity for select to authenticated
  using (private.can_view_task(task_id));

-- inventory: organization-wide read; admin-only writes.
drop policy if exists "Signed-in users can read inventory" on public.inventory;
create policy "Signed-in users can read inventory"
  on public.inventory for select to authenticated
  using (true);

drop policy if exists "Admins add inventory" on public.inventory;
create policy "Admins add inventory"
  on public.inventory for insert to authenticated
  with check (private.is_admin());

drop policy if exists "Admins update inventory" on public.inventory;
create policy "Admins update inventory"
  on public.inventory for update to authenticated
  using (private.is_admin())
  with check (private.is_admin());

drop policy if exists "Admins delete inventory" on public.inventory;
create policy "Admins delete inventory"
  on public.inventory for delete to authenticated
  using (private.is_admin());

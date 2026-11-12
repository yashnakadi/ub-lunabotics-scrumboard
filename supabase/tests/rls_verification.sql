-- =============================================================================
-- UB Lunabotics · permission (RLS) verification
--
-- Run in Supabase Dashboard -> SQL Editor AFTER applying both migrations
-- (20261112000000_initial_schema.sql and 20261113000000_email_login.sql).
--
-- It creates three temporary users (an admin, a Software member, and a
-- Mechanical member), then acts as each one to check that the database allows
-- and blocks exactly what it should.
--
-- NOTHING IS KEPT. The script always ends by raising an error, which rolls back
-- every row it created (users, tasks, inventory, team counters).
--
--   Success looks like:  ERROR: RLS verification PASSED: 44 checks ...
--   Failure looks like:  ERROR: FAIL: <what went wrong>
-- =============================================================================

do $$
declare
  v_suffix   text := substr(md5(random()::text), 1, 6);
  v_admin    uuid := gen_random_uuid();
  v_sw       uuid := gen_random_uuid();  -- member of Software
  v_me       uuid := gen_random_uuid();  -- member of Mechanical
  v_admin_email text := 'rls-admin-' || v_suffix || '@example.invalid';
  v_sw_email    text := 'rls-sw-'    || v_suffix || '@example.invalid';
  v_me_email    text := 'rls-me-'    || v_suffix || '@example.invalid';

  v_task_sw      uuid;  -- Software, assigned to the Software member
  v_task_sw_open uuid;  -- Software, unassigned
  v_task_cross   uuid;  -- Mechanical, assigned to the Software member
  v_task_me_open uuid;  -- Mechanical, unassigned
  v_item         uuid;
  v_check        uuid;
  v_number       integer;
  v_text         text;
  v_count        integer;
  v_passed       integer := 0;
begin
  -- ---------------------------------------------------------------------------
  -- Setup (as the SQL Editor's privileged role)
  -- ---------------------------------------------------------------------------
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                          email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                          created_at, updated_at)
  values
    (v_admin, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     v_admin_email, '', now(), '{}', '{"full_name": "RLS Admin"}', now(), now()),
    (v_sw, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     v_sw_email, '', now(), '{}', '{"full_name": "RLS Software", "role": "admin"}', now(), now()),
    (v_me, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     v_me_email, '', now(), '{}', '{}', now(), now());

  -- 1. The trigger created profiles, all as members, even when metadata asks for admin.
  select count(*) into v_count from public.profiles
   where id in (v_admin, v_sw, v_me) and role = 'member';
  if v_count <> 3 then raise exception 'FAIL: new users should get member profiles (got %)', v_count; end if;
  v_passed := v_passed + 1;

  -- 2. A display name comes from metadata, or the email when none was supplied.
  select full_name into v_text from public.profiles where id = v_me;
  if v_text is distinct from 'rls-me-' || v_suffix then raise exception 'FAIL: derived full_name was %', v_text; end if;
  if (select full_name from public.profiles where id = v_admin) <> 'RLS Admin' then
    raise exception 'FAIL: full_name from metadata was not used';
  end if;
  v_passed := v_passed + 1;

  perform private.configure_user(v_admin_email, 'RLS Admin', 'admin', '{}');
  perform private.configure_user(v_sw_email, 'RLS Software', 'member', array['software']);
  perform private.configure_user(v_me_email, 'RLS Mechanical', 'member', array['mechanical']);

  -- 3. configure_user rejects unknown teams.
  begin
    perform private.configure_user(v_me_email, 'RLS Mechanical', 'member', array['marketing']);
    raise exception 'FAIL: configure_user accepted an unknown team';
  exception when raise_exception then
    if sqlerrm not like '%Unknown team%' then raise; end if;
    v_passed := v_passed + 1;
  end;

  -- 4. The old username-to-email lookup no longer exists.
  if to_regprocedure('public.get_login_email(text)') is not null then
    raise exception 'FAIL: public.get_login_email still exists';
  end if;
  v_passed := v_passed + 1;

  -- 4b. The server-only secret key (service_role) can administer data.
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  perform set_config('role', 'service_role', true);
  update public.profiles set full_name = 'RLS Mechanical' where id = v_me;
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'FAIL: service_role could not update a profile'; end if;
  v_passed := v_passed + 1;
  perform set_config('role', session_user::text, true);

  -- ---------------------------------------------------------------------------
  -- Anonymous visitor (publishable key, no session)
  -- ---------------------------------------------------------------------------
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);

  -- 5. Anonymous users cannot read profiles.
  begin
    perform 1 from public.profiles;
    raise exception 'FAIL: anon could read profiles';
  exception when insufficient_privilege then v_passed := v_passed + 1;
  end;

  -- 6-7. Anonymous users cannot read tasks or inventory.
  begin
    perform 1 from public.tasks;
    raise exception 'FAIL: anon could read tasks';
  exception when insufficient_privilege then v_passed := v_passed + 1;
  end;
  begin
    perform 1 from public.inventory;
    raise exception 'FAIL: anon could read inventory';
  exception when insufficient_privilege then v_passed := v_passed + 1;
  end;

  -- ---------------------------------------------------------------------------
  -- Admin
  -- ---------------------------------------------------------------------------
  perform set_config('role', session_user::text, true);
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  -- 8. Admins can create tasks; numbering and creator are set by the database.
  insert into public.tasks (team_id, title, assigned_to)
  values ('software', 'RLS test: software task', v_sw)
  returning id, task_number into v_task_sw, v_number;
  if v_number is null or v_number < 1 then raise exception 'FAIL: task_number not assigned'; end if;
  if (select created_by from public.tasks where id = v_task_sw) is distinct from v_admin then
    raise exception 'FAIL: created_by not forced to the admin';
  end if;
  v_passed := v_passed + 1;

  insert into public.tasks (team_id, title) values ('software', 'RLS test: open software task')
  returning id into v_task_sw_open;
  insert into public.tasks (team_id, title, assigned_to) values ('mechanical', 'RLS test: cross-team task', v_sw)
  returning id into v_task_cross;
  insert into public.tasks (team_id, title) values ('mechanical', 'RLS test: open mechanical task')
  returning id into v_task_me_open;

  -- 9. Sequential numbers within a team.
  if (select task_number from public.tasks where id = v_task_sw_open) <> v_number + 1 then
    raise exception 'FAIL: task numbers are not sequential within a team';
  end if;
  v_passed := v_passed + 1;

  -- 10. Creation is recorded in the activity log.
  if not exists (select 1 from public.task_activity
                  where task_id = v_task_sw and action = 'created' and actor_id = v_admin) then
    raise exception 'FAIL: created activity was not logged';
  end if;
  v_passed := v_passed + 1;

  -- 11. Admins can add inventory.
  insert into public.inventory (item_name, category, quantity, storage_location)
  values ('RLS test item', 'Tools', 3, 'Test shelf') returning id into v_item;
  v_passed := v_passed + 1;

  -- 12. Admins see every team's memberships.
  select count(*) into v_count from public.team_members where user_id in (v_sw, v_me);
  if v_count <> 2 then raise exception 'FAIL: admin should see all memberships (saw %)', v_count; end if;
  v_passed := v_passed + 1;

  -- 13. Even admins cannot change roles through the API.
  begin
    update public.profiles set role = 'admin' where id = v_sw;
    raise exception 'FAIL: admin could change a role through the API';
  exception when insufficient_privilege then v_passed := v_passed + 1;
  end;

  -- ---------------------------------------------------------------------------
  -- Software member
  -- ---------------------------------------------------------------------------
  perform set_config('role', session_user::text, true);
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', v_sw, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  -- 14. Sees own-team tasks and the cross-team task assigned to them, but not
  --     the other team's unassigned task.
  select count(*) into v_count from public.tasks
   where id in (v_task_sw, v_task_sw_open, v_task_cross, v_task_me_open);
  if v_count <> 3 then raise exception 'FAIL: software member should see 3 tasks (saw %)', v_count; end if;
  if exists (select 1 from public.tasks where id = v_task_me_open) then
    raise exception 'FAIL: software member can see an unassigned mechanical task';
  end if;
  v_passed := v_passed + 1;

  -- 15. Members cannot create tasks.
  begin
    insert into public.tasks (team_id, title) values ('software', 'RLS test: member task');
    raise exception 'FAIL: member could create a task';
  exception when insufficient_privilege then v_passed := v_passed + 1;
  end;

  -- 16. Members can change the status of their own task (and it is logged).
  update public.tasks set status = 'in_progress' where id = v_task_sw;
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'FAIL: assignee could not update status'; end if;
  if not exists (select 1 from public.task_activity
                  where task_id = v_task_sw and action = 'status_changed' and actor_id = v_sw) then
    raise exception 'FAIL: status change was not logged';
  end if;
  v_passed := v_passed + 1;

  -- 17. ...including on a cross-team task assigned to them.
  update public.tasks set status = 'in_review' where id = v_task_cross;
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'FAIL: assignee could not update a cross-team task'; end if;
  v_passed := v_passed + 1;

  -- 18-21. Members cannot change restricted fields on their own task.
  begin
    update public.tasks set title = 'Renamed by member' where id = v_task_sw;
    raise exception 'FAIL: member changed a task title';
  exception when insufficient_privilege then v_passed := v_passed + 1;
  end;
  begin
    update public.tasks set assigned_to = v_me where id = v_task_sw;
    raise exception 'FAIL: member reassigned a task';
  exception when insufficient_privilege then v_passed := v_passed + 1;
  end;
  begin
    update public.tasks set priority = 'urgent' where id = v_task_sw;
    raise exception 'FAIL: member changed a priority';
  exception when insufficient_privilege then v_passed := v_passed + 1;
  end;
  begin
    update public.tasks set team_id = 'electrical' where id = v_task_sw;
    raise exception 'FAIL: member moved a task to another team';
  exception when insufficient_privilege then v_passed := v_passed + 1;
  end;

  -- 22. Members cannot move tasks that are not assigned to them.
  update public.tasks set status = 'done' where id = v_task_sw_open;
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'FAIL: member updated a task not assigned to them'; end if;
  v_passed := v_passed + 1;

  -- 23. Members cannot delete tasks.
  delete from public.tasks where id = v_task_sw;
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'FAIL: member deleted a task'; end if;
  v_passed := v_passed + 1;

  -- 24-27. Checklist: assignee may add and tick items, not reword or delete them.
  insert into public.task_checklist_items (task_id, content) values (v_task_sw, 'RLS test step')
  returning id into v_check;
  v_passed := v_passed + 1;

  update public.task_checklist_items set is_completed = true where id = v_check;
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'FAIL: assignee could not tick a checklist item'; end if;
  v_passed := v_passed + 1;

  begin
    update public.task_checklist_items set content = 'Reworded' where id = v_check;
    raise exception 'FAIL: member reworded a checklist item';
  exception when insufficient_privilege then v_passed := v_passed + 1;
  end;

  delete from public.task_checklist_items where id = v_check;
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'FAIL: member deleted a checklist item'; end if;
  v_passed := v_passed + 1;

  -- 28. Members cannot add checklist items to tasks they are not assigned.
  begin
    insert into public.task_checklist_items (task_id, content) values (v_task_sw_open, 'Nope');
    raise exception 'FAIL: member added a checklist item to someone else''s task';
  exception when insufficient_privilege then v_passed := v_passed + 1;
  end;

  -- 29. Comments are attributed to the poster.
  insert into public.task_comments (task_id, content) values (v_task_sw_open, 'RLS test comment');
  if not exists (select 1 from public.task_comments
                  where task_id = v_task_sw_open and author_id = v_sw) then
    raise exception 'FAIL: comment author was not set to the poster';
  end if;
  v_passed := v_passed + 1;

  -- 30. Members cannot comment on tasks they cannot see.
  begin
    insert into public.task_comments (task_id, content) values (v_task_me_open, 'Nope');
    raise exception 'FAIL: member commented on an invisible task';
  exception when insufficient_privilege then v_passed := v_passed + 1;
  end;

  -- 31. Nobody can forge activity history.
  begin
    insert into public.task_activity (task_id, action) values (v_task_sw, 'created');
    raise exception 'FAIL: member wrote to task_activity';
  exception when insufficient_privilege then v_passed := v_passed + 1;
  end;

  -- 32. Members can read all inventory...
  if not exists (select 1 from public.inventory where id = v_item) then
    raise exception 'FAIL: member cannot read inventory';
  end if;
  v_passed := v_passed + 1;

  -- 33-35. ...but cannot add, edit, or delete it.
  begin
    insert into public.inventory (item_name, category, storage_location) values ('Nope', 'Tools', 'X');
    raise exception 'FAIL: member added inventory';
  exception when insufficient_privilege then v_passed := v_passed + 1;
  end;
  update public.inventory set quantity = 99 where id = v_item;
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'FAIL: member edited inventory'; end if;
  v_passed := v_passed + 1;
  delete from public.inventory where id = v_item;
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'FAIL: member deleted inventory'; end if;
  v_passed := v_passed + 1;

  -- 36. Members cannot promote themselves.
  begin
    update public.profiles set role = 'admin' where id = v_sw;
    raise exception 'FAIL: member changed their own role';
  exception when insufficient_privilege then v_passed := v_passed + 1;
  end;

  -- 37. Members cannot add themselves to another team.
  begin
    insert into public.team_members (user_id, team_id) values (v_sw, 'mechanical');
    raise exception 'FAIL: member joined a team';
  exception when insufficient_privilege then v_passed := v_passed + 1;
  end;

  -- 38. Members cannot read anyone's email.
  begin
    perform email from public.profiles limit 1;
    raise exception 'FAIL: member could read profile emails';
  exception when insufficient_privilege then v_passed := v_passed + 1;
  end;

  -- 38b. The retired username column is not readable (or has been dropped).
  begin
    execute 'select username from public.profiles limit 1';
    raise exception 'FAIL: member could read profile usernames';
  exception when insufficient_privilege or undefined_column then v_passed := v_passed + 1;
  end;

  -- 39. Members cannot call internal helpers directly (e.g. burn task numbers).
  begin
    perform private.next_task_number('software');
    raise exception 'FAIL: member could call private.next_task_number';
  exception when insufficient_privilege then v_passed := v_passed + 1;
  end;

  -- ---------------------------------------------------------------------------
  -- Mechanical member
  -- ---------------------------------------------------------------------------
  perform set_config('role', session_user::text, true);
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', v_me, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  -- 40. Cannot see the Software board's tasks or their checklists/comments.
  if exists (select 1 from public.tasks where team_id = 'software' and id in (v_task_sw, v_task_sw_open))
  or exists (select 1 from public.task_comments where task_id = v_task_sw_open) then
    raise exception 'FAIL: mechanical member can see software tasks';
  end if;
  v_passed := v_passed + 1;

  -- ---------------------------------------------------------------------------
  -- Admin again: team moves renumber, deletes cascade
  -- ---------------------------------------------------------------------------
  perform set_config('role', session_user::text, true);
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  -- 41. Moving a task to another team gives it a number there and logs it.
  update public.tasks set team_id = 'electrical' where id = v_task_sw_open;
  if not exists (select 1 from public.task_activity
                  where task_id = v_task_sw_open and action = 'team_changed'
                    and details ->> 'to_key' like 'EL-%') then
    raise exception 'FAIL: team move was not renumbered/logged';
  end if;
  v_passed := v_passed + 1;

  -- 42. Admins can delete tasks; related rows go with them.
  delete from public.tasks where id = v_task_sw_open;
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'FAIL: admin could not delete a task'; end if;
  if exists (select 1 from public.task_comments where task_id = v_task_sw_open) then
    raise exception 'FAIL: comments were not deleted with the task';
  end if;
  v_passed := v_passed + 1;

  perform set_config('role', session_user::text, true);
  perform set_config('request.jwt.claims', '', true);

  raise exception 'RLS verification PASSED: % checks. All test data has been rolled back.', v_passed
    using hint = 'This "error" is intentional: it undoes everything the script created.';
end $$;

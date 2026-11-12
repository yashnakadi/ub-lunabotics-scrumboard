-- =============================================================================
-- UB Lunabotics · private.configure_user() verification
--
-- Run in Supabase Dashboard -> SQL Editor after applying
-- 20261114000000_configure_user_v2.sql.
--
-- Uses two temporary Auth users. NOTHING IS KEPT: the script always ends by
-- raising an error, which rolls back every change it made. Real accounts are
-- never read or modified.
--
--   Success looks like:  ERROR: configure_user verification PASSED: 25 checks ...
--   Failure looks like:  ERROR: FAIL: <what went wrong>
-- =============================================================================

do $$
declare
  v_suffix   text := substr(md5(random()::text), 1, 6);
  v_a        uuid := gen_random_uuid();
  v_b        uuid := gen_random_uuid();
  v_a_email  text := 'cfg-a-' || v_suffix || '@example.invalid';
  v_b_email  text := 'cfg-b-' || v_suffix || '@example.invalid';
  v_auth_before text;
  v_teams    text[];
  v_role     text;
  v_name     text;
  v_ctid     tid;
  v_count    integer;
  v_passed   integer := 0;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                          email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                          created_at, updated_at)
  values
    (v_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     v_a_email, 'not-a-real-hash-a', now(), '{}', '{}', now(), now()),
    (v_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     v_b_email, 'not-a-real-hash-b', now(), '{}', '{}', now(), now());

  -- Fingerprint of both Auth rows (includes password hash, email, metadata).
  select string_agg(md5(row_to_json(u)::text), ',' order by u.id) into v_auth_before
    from auth.users u where u.id in (v_a, v_b);

  -- 1. Configure an existing user as a Member, with one team (scenarios 1 + 3).
  perform private.configure_user(v_a_email, 'Config Tester', 'member', array['software']);
  select p.role::text, p.full_name into v_role, v_name from public.profiles p where p.id = v_a;
  select array_agg(team_id order by team_id) into v_teams from public.team_members where user_id = v_a;
  if v_role <> 'member' or v_name <> 'Config Tester' or v_teams is distinct from array['software'] then
    raise exception 'FAIL: member/one-team config wrong (%, %, %)', v_role, v_name, v_teams;
  end if;
  v_passed := v_passed + 1;

  -- 2. Email lookup is case-insensitive and ignores surrounding spaces.
  perform private.configure_user('  ' || upper(v_a_email) || ' ', 'Config Tester', 'member', array['software']);
  v_passed := v_passed + 1;

  -- 3. Configure as Admin with multiple teams (scenarios 2 + 4).
  perform private.configure_user(v_a_email, 'Config Tester', 'admin', array['software', 'electrical']);
  select p.role::text into v_role from public.profiles p where p.id = v_a;
  select array_agg(team_id order by team_id) into v_teams from public.team_members where user_id = v_a;
  if v_role <> 'admin' or v_teams is distinct from array['electrical', 'software'] then
    raise exception 'FAIL: admin/multi-team config wrong (%, %)', v_role, v_teams;
  end if;
  v_passed := v_passed + 1;

  -- 4. The team array REPLACES memberships (scenario 5).
  perform private.configure_user(v_a_email, 'Config Tester', 'admin', array['mechanical']);
  select array_agg(team_id order by team_id) into v_teams from public.team_members where user_id = v_a;
  if v_teams is distinct from array['mechanical'] then
    raise exception 'FAIL: teams were not replaced (%)', v_teams;
  end if;
  v_passed := v_passed + 1;

  -- 5. Team names are case-insensitive; duplicates collapse to one membership.
  perform private.configure_user(v_a_email, 'Config Tester', 'admin',
                                 array['Software', 'SOFTWARE', ' software ', 'Electrical']);
  select array_agg(team_id order by team_id) into v_teams from public.team_members where user_id = v_a;
  if v_teams is distinct from array['electrical', 'software'] then
    raise exception 'FAIL: case/duplicate handling wrong (%)', v_teams;
  end if;
  v_passed := v_passed + 1;

  -- 6. Empty array removes all memberships (scenario 6).
  perform private.configure_user(v_a_email, 'Config Tester', 'admin', array[]::text[]);
  select count(*) into v_count from public.team_members where user_id = v_a;
  if v_count <> 0 then raise exception 'FAIL: empty array left % memberships', v_count; end if;
  v_passed := v_passed + 1;

  -- 7. NULL leaves fields unchanged: rename only.
  perform private.configure_user(v_a_email, 'Config Tester', 'member', array['mechanical']);
  perform private.configure_user(v_a_email, 'Renamed Tester', null, null);
  select p.role::text, p.full_name into v_role, v_name from public.profiles p where p.id = v_a;
  select array_agg(team_id) into v_teams from public.team_members where user_id = v_a;
  if v_name <> 'Renamed Tester' or v_role <> 'member' or v_teams is distinct from array['mechanical'] then
    raise exception 'FAIL: NULL did not preserve fields (%, %, %)', v_name, v_role, v_teams;
  end if;
  v_passed := v_passed + 1;

  -- 8. Promote only (name and teams NULL).
  perform private.configure_user(v_a_email, null, 'ADMIN', null);
  select p.role::text, p.full_name into v_role, v_name from public.profiles p where p.id = v_a;
  if v_role <> 'admin' or v_name <> 'Renamed Tester' then
    raise exception 'FAIL: promote-only changed other fields (%, %)', v_role, v_name;
  end if;
  v_passed := v_passed + 1;

  -- 9. Idempotent: the same call twice changes nothing the second time (scenario 11).
  -- (ctid changes whenever a row is rewritten, even inside one transaction,
  -- unlike now()-based timestamps.)
  perform private.configure_user(v_a_email, 'Renamed Tester', 'admin', array['mechanical', 'software']);
  select p.ctid into v_ctid from public.profiles p where p.id = v_a;
  perform private.configure_user(v_a_email, 'Renamed Tester', 'admin', array['mechanical', 'software']);
  select count(*) into v_count from public.team_members where user_id = v_a;
  if v_count <> 2 then raise exception 'FAIL: repeat call changed membership count to %', v_count; end if;
  if (select p.ctid from public.profiles p where p.id = v_a) <> v_ctid then
    raise exception 'FAIL: repeat call rewrote the profile';
  end if;
  v_passed := v_passed + 1;

  -- 10. Return value reflects the saved state.
  select r.team_ids, r.role::text into v_teams, v_role
    from private.configure_user(v_a_email, null, null, null) r;
  if v_teams is distinct from array['mechanical', 'software'] or v_role <> 'admin' then
    raise exception 'FAIL: return value wrong (%, %)', v_teams, v_role;
  end if;
  v_passed := v_passed + 1;

  -- 11. A missing profile is recreated (as member by default when role is NULL).
  delete from public.profiles where id = v_b;
  perform private.configure_user(v_b_email, null, null, array['electrical']);
  select p.role::text, p.full_name into v_role, v_name from public.profiles p where p.id = v_b;
  if v_role <> 'member' or v_name <> 'cfg-b-' || v_suffix then
    raise exception 'FAIL: missing profile not recreated correctly (%, %)', v_role, v_name;
  end if;
  v_passed := v_passed + 1;

  -- 12-20. Rejections, each leaving the user unchanged (scenarios 7-10).
  select array_agg(team_id order by team_id) into v_teams from public.team_members where user_id = v_a;

  begin
    perform private.configure_user(v_a_email, 'X', 'member', array['software', 'marketing']);
    raise exception 'FAIL: unknown team accepted';
  exception when raise_exception then
    if sqlerrm not like 'Unknown team(s): marketing.%' then raise; end if;
    v_passed := v_passed + 1;
  end;
  begin
    perform private.configure_user(v_a_email, 'X', 'member', array['software', null]);
    raise exception 'FAIL: NULL team accepted';
  exception when raise_exception then
    if sqlerrm not like 'Unknown team(s): (blank).%' then raise; end if;
    v_passed := v_passed + 1;
  end;
  begin
    perform private.configure_user(v_a_email, 'X', 'superadmin', array['software']);
    raise exception 'FAIL: invalid role accepted';
  exception when raise_exception then
    if sqlerrm not like 'Invalid role%' then raise; end if;
    v_passed := v_passed + 1;
  end;
  begin
    perform private.configure_user('nobody-' || v_suffix || '@example.invalid', 'X', 'member', array['software']);
    raise exception 'FAIL: nonexistent email accepted';
  exception when raise_exception then
    if sqlerrm not like 'No Supabase Auth user has the email%' then raise; end if;
    v_passed := v_passed + 1;
  end;
  begin
    perform private.configure_user('   ', 'X', 'member', array['software']);
    raise exception 'FAIL: blank email accepted';
  exception when raise_exception then
    if sqlerrm not like 'An email address is required%' then raise; end if;
    v_passed := v_passed + 1;
  end;
  begin
    perform private.configure_user(v_a_email, '   ', 'member', array['software']);
    raise exception 'FAIL: blank name accepted';
  exception when raise_exception then
    if sqlerrm not like 'The full name cannot be blank%' then raise; end if;
    v_passed := v_passed + 1;
  end;
  begin
    perform private.configure_user(v_a_email, repeat('n', 121), 'member', array['software']);
    raise exception 'FAIL: overlong name accepted';
  exception when raise_exception then
    if sqlerrm not like 'The full name must be 120%' then raise; end if;
    v_passed := v_passed + 1;
  end;

  -- Failed calls are atomic: nothing about the user changed.
  select p.role::text, p.full_name into v_role, v_name from public.profiles p where p.id = v_a;
  if v_role <> 'admin' or v_name <> 'Renamed Tester'
  or (select array_agg(team_id order by team_id) from public.team_members where user_id = v_a) is distinct from v_teams then
    raise exception 'FAIL: a rejected call partially changed the user';
  end if;
  v_passed := v_passed + 1;

  -- No duplicate membership rows anywhere for these users.
  select count(*) into v_count from (
    select user_id, team_id from public.team_members where user_id in (v_a, v_b)
    group by user_id, team_id having count(*) > 1) d;
  if v_count <> 0 then raise exception 'FAIL: duplicate memberships exist'; end if;
  v_passed := v_passed + 1;

  -- 21. No API role holds EXECUTE (checked directly, not just by trying).
  if has_function_privilege('anon', 'private.configure_user(text,text,text,text[])', 'execute')
  or has_function_privilege('authenticated', 'private.configure_user(text,text,text,text[])', 'execute')
  or has_function_privilege('service_role', 'private.configure_user(text,text,text,text[])', 'execute')
  or exists (select 1 from information_schema.routine_privileges
              where routine_schema = 'private' and routine_name = 'configure_user' and grantee = 'PUBLIC') then
    raise exception 'FAIL: an API role or PUBLIC can execute configure_user';
  end if;
  v_passed := v_passed + 1;

  -- 22-24. Unauthorized callers are refused when they try (scenario 12).
  perform set_config('request.jwt.claims', json_build_object('sub', v_b, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  begin
    perform private.configure_user(v_b_email, 'Hacker', 'admin', array['software']);
    raise exception 'FAIL: authenticated user executed configure_user';
  exception when insufficient_privilege then v_passed := v_passed + 1;
  end;
  perform set_config('role', session_user::text, true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
  begin
    perform private.configure_user(v_b_email, 'Hacker', 'admin', array['software']);
    raise exception 'FAIL: anon executed configure_user';
  exception when insufficient_privilege then v_passed := v_passed + 1;
  end;
  perform set_config('role', session_user::text, true);
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  perform set_config('role', 'service_role', true);
  begin
    perform private.configure_user(v_b_email, 'Hacker', 'admin', array['software']);
    raise exception 'FAIL: service_role executed configure_user';
  exception when insufficient_privilege then v_passed := v_passed + 1;
  end;
  perform set_config('role', session_user::text, true);
  perform set_config('request.jwt.claims', '', true);

  if (select p.role from public.profiles p where p.id = v_b) <> 'member' then
    raise exception 'FAIL: an unauthorized call changed a role';
  end if;

  -- 25. Supabase Auth records (passwords, emails, metadata) are untouched (scenario 14).
  if (select string_agg(md5(row_to_json(u)::text), ',' order by u.id)
        from auth.users u where u.id in (v_a, v_b)) is distinct from v_auth_before then
    raise exception 'FAIL: auth.users rows were modified';
  end if;
  v_passed := v_passed + 1;

  raise exception 'configure_user verification PASSED: % checks. All test data has been rolled back.', v_passed
    using hint = 'This "error" is intentional: it undoes everything the script created.';
end $$;

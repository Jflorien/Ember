-- =============================================================================
-- RLS leak test
-- =============================================================================
-- The automated version of the manual check CLAUDE.md calls for: "log in as
-- a player, try to select a dm_only event, confirm zero rows." Runs against
-- a disposable local Supabase instance in CI (see .github/workflows/ci.yml)
-- — never against a real project — so it needs no secrets.
--
-- Seeds one campaign with a DM, a player, and a non-member outsider, plus
-- one event per visibility branch, then exercises public.events' RLS policy
-- as each persona by switching to the `authenticated` role and setting
-- request.jwt.claim.sub (the same mechanism PostgREST uses for a real
-- request). Everything this script creates is rolled back at the end,
-- whether the assertions pass or fail — a failed assertion aborts the
-- transaction, and an aborted transaction is discarded when psql exits.
-- =============================================================================

begin;

do $$
declare
  v_dm       uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_player   uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  v_outsider uuid := 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  v_campaign uuid := 'dddddddd-dddd-dddd-dddd-dddddddddddd';
  v_session  uuid := 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data
  )
  values
    ('00000000-0000-0000-0000-000000000000', v_dm, 'authenticated', 'authenticated',
     'rls-test-dm@ember.invalid', crypt('not-a-real-password', gen_salt('bf')),
     now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    ('00000000-0000-0000-0000-000000000000', v_player, 'authenticated', 'authenticated',
     'rls-test-player@ember.invalid', crypt('not-a-real-password', gen_salt('bf')),
     now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    ('00000000-0000-0000-0000-000000000000', v_outsider, 'authenticated', 'authenticated',
     'rls-test-outsider@ember.invalid', crypt('not-a-real-password', gen_salt('bf')),
     now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb);

  insert into public.campaigns (id, owner_id, name)
  values (v_campaign, v_dm, 'RLS leak test campaign');

  insert into public.memberships (campaign_id, user_id, role)
  values (v_campaign, v_player, 'player');

  insert into public.sessions (id, campaign_id, status)
  values (v_session, v_campaign, 'active');

  insert into public.events (id, session_id, seq, type, actor, payload, visibility, proposed_by)
  values
    ('01ARZ3NDEKTSV4RRFFQ69G5FA1', v_session, 1, 'narration', null,
     '{"v":1,"text":"public"}'::jsonb, 'public', 'human'),
    ('01ARZ3NDEKTSV4RRFFQ69G5FA2', v_session, 2, 'narration', null,
     '{"v":1,"text":"dm only"}'::jsonb, 'dm_only', 'human'),
    ('01ARZ3NDEKTSV4RRFFQ69G5FA3', v_session, 3, 'narration', null,
     '{"v":1,"text":"player private"}'::jsonb, 'player:' || v_player, 'human');
end $$;

-- As the player: sees the public event and their own player:<uuid> event,
-- never the dm_only one. This is the actual leak check.
set local role authenticated;
set local request.jwt.claim.sub = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

do $$
declare
  v_dm_only_visible integer;
  v_total_visible integer;
begin
  select count(*) into v_dm_only_visible
  from public.events
  where session_id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee' and visibility = 'dm_only';

  if v_dm_only_visible != 0 then
    raise exception 'RLS LEAK: player selected % dm_only event(s) — should be 0', v_dm_only_visible;
  end if;

  select count(*) into v_total_visible
  from public.events
  where session_id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';

  if v_total_visible != 2 then
    raise exception 'player should see exactly 2 events (public + their own player-scoped one), saw %', v_total_visible;
  end if;
end $$;

reset role;

-- As the DM: sees all three, including dm_only.
set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

do $$
declare
  v_total_visible integer;
begin
  select count(*) into v_total_visible
  from public.events
  where session_id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';

  if v_total_visible != 3 then
    raise exception 'DM should see all 3 events, saw %', v_total_visible;
  end if;
end $$;

reset role;

-- As a non-member outsider: sees nothing, not even the public event —
-- is_campaign_member() gates the whole policy, visibility aside.
set local role authenticated;
set local request.jwt.claim.sub = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

do $$
declare
  v_total_visible integer;
begin
  select count(*) into v_total_visible
  from public.events
  where session_id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';

  if v_total_visible != 0 then
    raise exception 'non-member outsider should see 0 events, saw %', v_total_visible;
  end if;
end $$;

reset role;

rollback;

select 'RLS leak test passed' as result;

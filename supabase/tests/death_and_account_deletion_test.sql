-- =============================================================================
-- `death` event validation + GDPR account deletion test
-- =============================================================================
-- Covers supabase/migrations/0012_death_and_account_deletion.sql:
--
--   1. validate_event_target() now covers 'death', which carries the same
--      single targetId shape as damage/heal/condition/loot.
--   2. death is deliberately NOT in events_insert_player_self_action — a
--      player can self-report damage, but not declare their own character
--      dead. Asserted here so a future widening of that policy has to
--      break this test on purpose rather than by accident.
--   3. delete_my_account() erases the caller's auth.users row and nothing
--      else, with the cascade taking their campaigns/characters with it.
--
-- Same disposable-instance, simulated-user technique as every other test
-- here; everything is rolled back at the end regardless of outcome.
-- =============================================================================

begin;

do $$
declare
  v_dm        uuid := 'b0b0b0b0-b0b0-b0b0-b0b0-b0b0b0b0b0b0';
  v_player    uuid := 'c0c0c0c0-c0c0-c0c0-c0c0-c0c0c0c0c0c0';
  v_campaign  uuid := 'd0d0d0d0-d0d0-d0d0-d0d0-d0d0d0d0d0d0';
  v_other_cmp uuid := 'e0e0e0e0-e0e0-e0e0-e0e0-e0e0e0e0e0e0';
  v_session   uuid := 'f0f0f0f0-f0f0-f0f0-f0f0-f0f0f0f0f0f0';
  v_char      uuid := '11111111-2222-3333-4444-555555555555';
  v_far_char  uuid := '66666666-7777-8888-9999-aaaaaaaaaaaa';
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data
  )
  values
    ('00000000-0000-0000-0000-000000000000', v_dm, 'authenticated', 'authenticated',
     'death-test-dm@ember.invalid', crypt('not-a-real-password', gen_salt('bf')),
     now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    ('00000000-0000-0000-0000-000000000000', v_player, 'authenticated', 'authenticated',
     'death-test-player@ember.invalid', crypt('not-a-real-password', gen_salt('bf')),
     now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb);

  insert into public.campaigns (id, owner_id, name, invite_code)
  values
    (v_campaign, v_dm, 'Death test campaign', 'DEATHTS1'),
    (v_other_cmp, v_dm, 'Unrelated campaign', 'DEATHTS2');

  insert into public.memberships (campaign_id, user_id, role)
  values (v_campaign, v_player, 'player');

  insert into public.sessions (id, campaign_id, status)
  values (v_session, v_campaign, 'active');

  insert into public.characters (id, campaign_id, owner_id, name, sheet)
  values
    (v_char, v_campaign, v_player, 'Doomed character', '{"maxHp": 20}'::jsonb),
    (v_far_char, v_other_cmp, v_dm, 'Character elsewhere', '{"maxHp": 20}'::jsonb);
end $$;

set local role authenticated;
set local request.jwt.claim.sub = 'b0b0b0b0-b0b0-b0b0-b0b0-b0b0b0b0b0b0';

-- The DM declaring a death on a character in this session's campaign: allowed.
insert into public.events (id, session_id, type, actor, payload, visibility, proposed_by)
values (
  '01DEATHTEST0000000000000AA', 'f0f0f0f0-f0f0-f0f0-f0f0-f0f0f0f0f0f0', 'death', null,
  '{"v":1,"targetId":"11111111-2222-3333-4444-555555555555","cause":"a falling rock","characterName":"Doomed character"}'::jsonb,
  'public', 'human'
);

-- A death naming a character in a *different* campaign: rejected by the trigger.
do $$
begin
  insert into public.events (id, session_id, type, actor, payload, visibility, proposed_by)
  values (
    '01DEATHTEST0000000000000BB', 'f0f0f0f0-f0f0-f0f0-f0f0-f0f0f0f0f0f0', 'death', null,
    '{"v":1,"targetId":"66666666-7777-8888-9999-aaaaaaaaaaaa","cause":null,"characterName":null}'::jsonb,
    'public', 'human'
  );
  raise exception 'ASSERTION FAILED: death committed against a character in another campaign';
exception
  when others then
    if sqlerrm like 'ASSERTION FAILED%' then
      raise;
    end if;
end $$;

-- A death naming a character that doesn't exist at all: rejected.
do $$
begin
  insert into public.events (id, session_id, type, actor, payload, visibility, proposed_by)
  values (
    '01DEATHTEST0000000000000CC', 'f0f0f0f0-f0f0-f0f0-f0f0-f0f0f0f0f0f0', 'death', null,
    '{"v":1,"targetId":"99999999-9999-9999-9999-999999999999","cause":null,"characterName":null}'::jsonb,
    'public', 'human'
  );
  raise exception 'ASSERTION FAILED: death committed against a nonexistent character';
exception
  when others then
    if sqlerrm like 'ASSERTION FAILED%' then
      raise;
    end if;
end $$;

reset role;

-- A non-DM player declaring death, even on their OWN character: rejected.
-- events_insert_player_self_action covers attack/move/cast/damage/heal/
-- condition, and deliberately not this.
set local role authenticated;
set local request.jwt.claim.sub = 'c0c0c0c0-c0c0-c0c0-c0c0-c0c0c0c0c0c0';

do $$
begin
  insert into public.events (id, session_id, type, actor, payload, visibility, proposed_by)
  values (
    '01DEATHTEST0000000000000DD', 'f0f0f0f0-f0f0-f0f0-f0f0-f0f0f0f0f0f0', 'death', null,
    '{"v":1,"targetId":"11111111-2222-3333-4444-555555555555","cause":null,"characterName":null}'::jsonb,
    'public', 'human'
  );
  raise exception 'ASSERTION FAILED: a player declared death on their own character';
exception
  when others then
    if sqlerrm like 'ASSERTION FAILED%' then
      raise;
    end if;
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- delete_my_account(): erases the caller and only the caller.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = 'c0c0c0c0-c0c0-c0c0-c0c0-c0c0c0c0c0c0';

select public.delete_my_account();

reset role;

do $$
begin
  if exists (select 1 from auth.users where id = 'c0c0c0c0-c0c0-c0c0-c0c0-c0c0c0c0c0c0') then
    raise exception 'ASSERTION FAILED: delete_my_account did not delete the caller';
  end if;

  -- The cascade should have taken the player's character with them...
  if exists (select 1 from public.characters where id = '11111111-2222-3333-4444-555555555555') then
    raise exception 'ASSERTION FAILED: deleted account left its character behind';
  end if;

  -- ...but must not touch anyone else's account or data.
  if not exists (select 1 from auth.users where id = 'b0b0b0b0-b0b0-b0b0-b0b0-b0b0b0b0b0b0') then
    raise exception 'ASSERTION FAILED: delete_my_account deleted another user';
  end if;

  if not exists (select 1 from public.characters where id = '66666666-7777-8888-9999-aaaaaaaaaaaa') then
    raise exception 'ASSERTION FAILED: delete_my_account deleted another user''s character';
  end if;
end $$;

-- Unauthenticated callers get a clean error, not a silent no-op.
set local role authenticated;
set local request.jwt.claim.sub = '';

do $$
begin
  perform public.delete_my_account();
  raise exception 'ASSERTION FAILED: delete_my_account ran without an authenticated caller';
exception
  when others then
    if sqlerrm like 'ASSERTION FAILED%' then
      raise;
    end if;
end $$;

reset role;

rollback;

select 'death + account deletion test passed' as result;

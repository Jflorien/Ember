-- =============================================================================
-- Event target validation test
-- =============================================================================
-- Automated check for the events_validate_target trigger (see
-- supabase/migrations/0004_validate_event_targets.sql): a damage/heal/
-- condition event must name a targetId that's a real character in the
-- same campaign as the event's session. Runs against the same disposable
-- local instance as the RLS leak test — see that file's header for why
-- this needs no secrets.
--
-- Everything here is rolled back at the end, same as the RLS leak test.
-- =============================================================================

begin;

do $$
declare
  v_dm         uuid := '11111111-1111-1111-1111-111111111111';
  v_campaign_a uuid := '22222222-2222-2222-2222-222222222222';
  v_campaign_b uuid := '33333333-3333-3333-3333-333333333333';
  v_session_a  uuid := '44444444-4444-4444-4444-444444444444';
  v_character_a uuid := '55555555-5555-5555-5555-555555555555';
  v_character_b uuid := '66666666-6666-6666-6666-666666666666';
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data
  )
  values (
    '00000000-0000-0000-0000-000000000000', v_dm, 'authenticated', 'authenticated',
    'target-validation-test-dm@ember.invalid', crypt('not-a-real-password', gen_salt('bf')),
    now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb
  );

  insert into public.campaigns (id, owner_id, name, invite_code)
  values
    (v_campaign_a, v_dm, 'Target validation test campaign A', 'TARGETA1'),
    (v_campaign_b, v_dm, 'Target validation test campaign B', 'TARGETB1');

  insert into public.sessions (id, campaign_id, status)
  values (v_session_a, v_campaign_a, 'active');

  insert into public.characters (id, campaign_id, owner_id, name, sheet)
  values
    (v_character_a, v_campaign_a, v_dm, 'Character A', '{"maxHp": 20}'::jsonb),
    (v_character_b, v_campaign_b, v_dm, 'Character B', '{"maxHp": 20}'::jsonb);
end $$;

-- A narration event needs no targetId — the trigger no-ops for types
-- outside (damage, heal, condition).
insert into public.events (id, session_id, type, actor, payload, visibility, proposed_by)
values (
  '01TARGETTESTAAAAAAAAAAAAAA', '44444444-4444-4444-4444-444444444444', 'narration', null,
  '{"v":1,"text":"no target needed"}'::jsonb, 'public', 'human'
);

-- Damage against a character actually in this session's campaign: allowed.
insert into public.events (id, session_id, type, actor, payload, visibility, proposed_by)
values (
  '01TARGETTESTBBBBBBBBBBBBBB', '44444444-4444-4444-4444-444444444444', 'damage', null,
  '{"v":1,"targetId":"55555555-5555-5555-5555-555555555555","amount":5,"damageType":"slashing","source":null}'::jsonb,
  'public', 'human'
);

-- Damage against a real character from a *different* campaign: must be rejected.
do $$
begin
  insert into public.events (id, session_id, type, actor, payload, visibility, proposed_by)
  values (
    '01TARGETTESTCCCCCCCCCCCCCC', '44444444-4444-4444-4444-444444444444', 'damage', null,
    '{"v":1,"targetId":"66666666-6666-6666-6666-666666666666","amount":5,"damageType":"slashing","source":null}'::jsonb,
    'public', 'human'
  );
  raise exception 'ASSERTION FAILED: damage against a character from a different campaign was accepted';
exception
  when others then
    if sqlerrm like 'ASSERTION FAILED%' then
      raise;
    end if;
    -- Any other error is the trigger correctly rejecting the insert.
end $$;

-- Damage against a targetId that doesn't reference any character: must be rejected.
do $$
begin
  insert into public.events (id, session_id, type, actor, payload, visibility, proposed_by)
  values (
    '01TARGETTESTDDDDDDDDDDDDDD', '44444444-4444-4444-4444-444444444444', 'damage', null,
    '{"v":1,"targetId":"77777777-7777-7777-7777-777777777777","amount":5,"damageType":"slashing","source":null}'::jsonb,
    'public', 'human'
  );
  raise exception 'ASSERTION FAILED: damage against a nonexistent character was accepted';
exception
  when others then
    if sqlerrm like 'ASSERTION FAILED%' then
      raise;
    end if;
end $$;

-- Attack against a character actually in this session's campaign: allowed
-- (0005_validate_attack_targets.sql widened the same trigger to cover attack).
insert into public.events (id, session_id, type, actor, payload, visibility, proposed_by)
values (
  '01TARGETTESTEEEEEEEEEEEEEE', '44444444-4444-4444-4444-444444444444', 'attack', null,
  '{"v":1,"attackerId":"55555555-5555-5555-5555-555555555555","targetId":"55555555-5555-5555-5555-555555555555","roll":15,"rawRolls":[15],"seed":1,"modifier":3,"total":18,"targetAc":14,"advantage":"normal","critical":false,"hit":true}'::jsonb,
  'public', 'human'
);

-- Attack against a real character from a *different* campaign: must be rejected.
do $$
begin
  insert into public.events (id, session_id, type, actor, payload, visibility, proposed_by)
  values (
    '01TARGETTESTFFFFFFFFFFFFFF', '44444444-4444-4444-4444-444444444444', 'attack', null,
    '{"v":1,"attackerId":"55555555-5555-5555-5555-555555555555","targetId":"66666666-6666-6666-6666-666666666666","roll":15,"rawRolls":[15],"seed":1,"modifier":3,"total":18,"targetAc":14,"advantage":"normal","critical":false,"hit":true}'::jsonb,
    'public', 'human'
  );
  raise exception 'ASSERTION FAILED: attack against a character from a different campaign was accepted';
exception
  when others then
    if sqlerrm like 'ASSERTION FAILED%' then
      raise;
    end if;
end $$;

-- Loot against a character actually in this session's campaign: allowed
-- (0007_validate_loot_targets.sql widened the same trigger to cover loot).
insert into public.events (id, session_id, type, actor, payload, visibility, proposed_by)
values (
  '01TARGETTESTGGGGGGGGGGGGGG', '44444444-4444-4444-4444-444444444444', 'loot', null,
  '{"v":1,"targetId":"55555555-5555-5555-5555-555555555555","items":[{"itemId":null,"name":"Healing Potion","quantity":2}]}'::jsonb,
  'public', 'human'
);

-- Loot against a real character from a *different* campaign: must be rejected.
do $$
begin
  insert into public.events (id, session_id, type, actor, payload, visibility, proposed_by)
  values (
    '01TARGETTESTHHHHHHHHHHHHHH', '44444444-4444-4444-4444-444444444444', 'loot', null,
    '{"v":1,"targetId":"66666666-6666-6666-6666-666666666666","items":[{"itemId":null,"name":"Healing Potion","quantity":2}]}'::jsonb,
    'public', 'human'
  );
  raise exception 'ASSERTION FAILED: loot against a character from a different campaign was accepted';
exception
  when others then
    if sqlerrm like 'ASSERTION FAILED%' then
      raise;
    end if;
end $$;

rollback;

select 'event target validation test passed' as result;

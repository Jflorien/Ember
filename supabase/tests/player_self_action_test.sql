-- =============================================================================
-- Player self-action RLS test
-- =============================================================================
-- Covers the events_insert_player_self_action policy (see
-- supabase/migrations/0006_player_self_action_events.sql): a non-DM campaign
-- member may insert an attack event where they own the attacker, or a
-- damage/heal/condition event where they own the target — and nothing else.
-- Same disposable-instance, simulated-second-user technique as the RLS leak
-- test; everything here is rolled back at the end regardless of outcome.
-- =============================================================================

begin;

do $$
declare
  v_dm       uuid := '10101010-1010-1010-1010-101010101010';
  v_player   uuid := '20202020-2020-2020-2020-202020202020';
  v_campaign uuid := '30303030-3030-3030-3030-303030303030';
  v_session  uuid := '40404040-4040-4040-4040-404040404040';
  v_char_a   uuid := '50505050-5050-5050-5050-505050505050'; -- owned by the player
  v_char_b   uuid := '60606060-6060-6060-6060-606060606060'; -- owned by the DM
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data
  )
  values
    ('00000000-0000-0000-0000-000000000000', v_dm, 'authenticated', 'authenticated',
     'self-action-test-dm@ember.invalid', crypt('not-a-real-password', gen_salt('bf')),
     now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    ('00000000-0000-0000-0000-000000000000', v_player, 'authenticated', 'authenticated',
     'self-action-test-player@ember.invalid', crypt('not-a-real-password', gen_salt('bf')),
     now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb);

  insert into public.campaigns (id, owner_id, name, invite_code)
  values (v_campaign, v_dm, 'Self-action test campaign', 'SELFACT1');

  insert into public.memberships (campaign_id, user_id, role)
  values (v_campaign, v_player, 'player');

  insert into public.sessions (id, campaign_id, status)
  values (v_session, v_campaign, 'active');

  insert into public.characters (id, campaign_id, owner_id, name, sheet)
  values
    (v_char_a, v_campaign, v_player, 'Player-owned character', '{"maxHp": 20}'::jsonb),
    (v_char_b, v_campaign, v_dm, 'DM-owned character', '{"maxHp": 20}'::jsonb);
end $$;

set local role authenticated;
set local request.jwt.claim.sub = '20202020-2020-2020-2020-202020202020';

-- Attack where the player owns the attacker: allowed. Target can be anyone.
insert into public.events (id, session_id, type, actor, payload, visibility, proposed_by)
values (
  '01SEFACTNAAAAAAAAAAAAAAAAA', '40404040-4040-4040-4040-404040404040', 'attack', null,
  '{"v":1,"attackerId":"50505050-5050-5050-5050-505050505050","targetId":"60606060-6060-6060-6060-606060606060","roll":15,"rawRolls":[15],"seed":1,"modifier":3,"total":18,"targetAc":14,"advantage":"normal","critical":false,"hit":true}'::jsonb,
  'public', 'human'
);

-- Damage/heal/condition targeting the player's own character: allowed.
insert into public.events (id, session_id, type, actor, payload, visibility, proposed_by)
values (
  '01SEFACTNBBBBBBBBBBBBBBBBB', '40404040-4040-4040-4040-404040404040', 'damage', null,
  '{"v":1,"targetId":"50505050-5050-5050-5050-505050505050","amount":5,"damageType":"fire","source":"trap"}'::jsonb,
  'public', 'human'
);

-- Attack where the player does NOT own the attacker: rejected.
do $$
begin
  insert into public.events (id, session_id, type, actor, payload, visibility, proposed_by)
  values (
    '01SEFACTNCCCCCCCCCCCCCCCCC', '40404040-4040-4040-4040-404040404040', 'attack', null,
    '{"v":1,"attackerId":"60606060-6060-6060-6060-606060606060","targetId":"50505050-5050-5050-5050-505050505050","roll":15,"rawRolls":[15],"seed":1,"modifier":3,"total":18,"targetAc":14,"advantage":"normal","critical":false,"hit":true}'::jsonb,
    'public', 'human'
  );
  raise exception 'ASSERTION FAILED: player attacked with a character they do not own';
exception
  when others then
    if sqlerrm like 'ASSERTION FAILED%' then
      raise;
    end if;
end $$;

-- Damage targeting a character the player does NOT own: rejected — a player
-- can self-report what happens to them, not deal damage to someone else.
do $$
begin
  insert into public.events (id, session_id, type, actor, payload, visibility, proposed_by)
  values (
    '01SEFACTNDDDDDDDDDDDDDDDDD', '40404040-4040-4040-4040-404040404040', 'damage', null,
    '{"v":1,"targetId":"60606060-6060-6060-6060-606060606060","amount":5,"damageType":"fire","source":null}'::jsonb,
    'public', 'human'
  );
  raise exception 'ASSERTION FAILED: player dealt damage to a character they do not own';
exception
  when others then
    if sqlerrm like 'ASSERTION FAILED%' then
      raise;
    end if;
end $$;

-- Move where the player owns the actor: allowed.
insert into public.events (id, session_id, type, actor, payload, visibility, proposed_by)
values (
  '01SEFACTNGGGGGGGGGGGGGGGGG', '40404040-4040-4040-4040-404040404040', 'move', null,
  '{"v":1,"actorId":"50505050-5050-5050-5050-505050505050","from":{"x":0,"y":0},"to":{"x":1,"y":0},"feetSpent":5,"feetRemaining":0}'::jsonb,
  'public', 'human'
);

-- Move where the player does NOT own the actor: rejected.
do $$
begin
  insert into public.events (id, session_id, type, actor, payload, visibility, proposed_by)
  values (
    '01SEFACTNHHHHHHHHHHHHHHHHH', '40404040-4040-4040-4040-404040404040', 'move', null,
    '{"v":1,"actorId":"60606060-6060-6060-6060-606060606060","from":{"x":0,"y":0},"to":{"x":1,"y":0},"feetSpent":5,"feetRemaining":0}'::jsonb,
    'public', 'human'
  );
  raise exception 'ASSERTION FAILED: player moved a character they do not own';
exception
  when others then
    if sqlerrm like 'ASSERTION FAILED%' then
      raise;
    end if;
end $$;

-- Narration from a non-DM player: rejected — the new policy only widens
-- attack/damage/heal/condition/move, nothing else.
do $$
begin
  insert into public.events (id, session_id, type, actor, payload, visibility, proposed_by)
  values (
    '01SEFACTNEEEEEEEEEEEEEEEEE', '40404040-4040-4040-4040-404040404040', 'narration', null,
    '{"v":1,"text":"a player narrating"}'::jsonb, 'public', 'human'
  );
  raise exception 'ASSERTION FAILED: non-DM player inserted a narration event';
exception
  when others then
    if sqlerrm like 'ASSERTION FAILED%' then
      raise;
    end if;
end $$;

reset role;

-- Sanity check the original DM-only policy still stands: the DM can still
-- insert anything, including an attack/damage naming a character they don't
-- own the attacker/target role for in the player sense (DM isn't scoped by
-- ownership at all).
set local role authenticated;
set local request.jwt.claim.sub = '10101010-1010-1010-1010-101010101010';

insert into public.events (id, session_id, type, actor, payload, visibility, proposed_by)
values (
  '01SEFACTNFFFFFFFFFFFFFFFFF', '40404040-4040-4040-4040-404040404040', 'damage', null,
  '{"v":1,"targetId":"50505050-5050-5050-5050-505050505050","amount":3,"damageType":"cold","source":null}'::jsonb,
  'public', 'human'
);

reset role;

rollback;

select 'player self-action test passed' as result;

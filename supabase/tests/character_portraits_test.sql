-- =============================================================================
-- Character portrait storage RLS test
-- =============================================================================
-- Covers supabase/migrations/0011_character_portraits_storage.sql: only a
-- character's owner may insert/update/delete its portrait object in the
-- character-portraits bucket (path <character_id>/...), gated by the same
-- owns_character() helper 0006 already uses for player-self-action events.
-- Reads are public — no RLS needed for those. Same disposable-instance,
-- simulated-user technique as every other RLS test here; everything is
-- rolled back at the end regardless of outcome.
-- =============================================================================

begin;

do $$
declare
  v_owner    uuid := '70707070-7070-7070-7070-707070707070';
  v_other    uuid := '80808080-8080-8080-8080-808080808080';
  v_campaign uuid := '90909090-9090-9090-9090-909090909090';
  v_char     uuid := 'a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0'; -- owned by v_owner
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data
  )
  values
    ('00000000-0000-0000-0000-000000000000', v_owner, 'authenticated', 'authenticated',
     'portrait-test-owner@ember.invalid', crypt('not-a-real-password', gen_salt('bf')),
     now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    ('00000000-0000-0000-0000-000000000000', v_other, 'authenticated', 'authenticated',
     'portrait-test-other@ember.invalid', crypt('not-a-real-password', gen_salt('bf')),
     now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb);

  insert into public.campaigns (id, owner_id, name, invite_code)
  values (v_campaign, v_owner, 'Portrait test campaign', 'PORTRAIT1');

  insert into public.characters (id, campaign_id, owner_id, name, sheet)
  values (v_char, v_campaign, v_owner, 'Portrait test character', '{"maxHp": 20}'::jsonb);
end $$;

-- The character's owner uploads its portrait: allowed.
set local role authenticated;
set local request.jwt.claim.sub = '70707070-7070-7070-7070-707070707070';

insert into storage.objects (bucket_id, name, owner)
values ('character-portraits', 'a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0/portrait.png', auth.uid());

-- The same owner replaces it: allowed. A no-op UPDATE (0 rows matched)
-- wouldn't raise on its own, so check row count explicitly rather than
-- trusting the statement not erroring.
do $$
declare
  v_count integer;
begin
  update storage.objects
  set owner = auth.uid()
  where bucket_id = 'character-portraits'
    and name = 'a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0/portrait.png';
  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'ASSERTION FAILED: owner could not update their own character portrait';
  end if;
end $$;

reset role;

-- A different, non-owning user tries to upload to that character's folder: rejected.
set local role authenticated;
set local request.jwt.claim.sub = '80808080-8080-8080-8080-808080808080';

do $$
begin
  insert into storage.objects (bucket_id, name, owner)
  values ('character-portraits', 'a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0/portrait.png', auth.uid());
  raise exception 'ASSERTION FAILED: non-owner uploaded a portrait for a character they do not own';
exception
  when others then
    if sqlerrm like 'ASSERTION FAILED%' then
      raise;
    end if;
end $$;

-- That same non-owner tries to overwrite the existing portrait: rejected.
do $$
begin
  update storage.objects
  set owner = auth.uid()
  where bucket_id = 'character-portraits'
    and name = 'a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0/portrait.png';
  if found then
    raise exception 'ASSERTION FAILED: non-owner updated a portrait for a character they do not own';
  end if;
end $$;

reset role;

-- Reads are public — the anon role can select it without any RLS write bypass.
set local role anon;
do $$
begin
  if not exists (
    select 1 from storage.objects
    where bucket_id = 'character-portraits'
      and name = 'a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0/portrait.png'
  ) then
    raise exception 'ASSERTION FAILED: anon could not read a public character-portraits object';
  end if;
end $$;
reset role;

rollback;

select 'character portrait storage RLS test passed' as result;

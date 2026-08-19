-- =============================================================================
-- Ember — the `death` event type, and GDPR account deletion
-- =============================================================================
-- Two unrelated-looking things ship together because both are prerequisites
-- for the player dashboard restructure: the character roster splits living
-- characters from dead ones (needs `death`), and the account settings page
-- needs a real "delete my account" path (GDPR art. 17).
--
-- 1. `death` joins the target-validation trigger. It carries the same single
--    `targetId` shape as damage/heal/condition/loot, so it just gets added to
--    the type list — no new branch needed, unlike `cast` in 0010.
--
--    Deliberately NOT added to events_insert_player_self_action: a player can
--    self-report damage, healing and conditions, but declaring a character
--    dead is the DM's call. The policy is left untouched, so `death` stays
--    DM-only via events_insert_dm_only.
--
-- 2. delete_my_account() erases the caller's account. Deleting the auth.users
--    row cascades all the way down (auth.users -> public.users -> campaigns
--    they own -> sessions -> events, plus their characters and memberships),
--    which is what erasure means — but it also destroys campaigns other
--    people play in, so the UI warns about owned campaigns before calling it.
--
--    security definer because deleting from auth.users is not something the
--    `authenticated` role can do directly, and this project has no
--    service-role key configured (the app builds and runs on the anon key
--    alone — see src/lib/supabase/env.ts). Scoped to auth.uid() only, so it
--    can never delete anyone else: it takes no arguments by design.
-- =============================================================================

create or replace function public.validate_event_target()
returns trigger
language plpgsql
as $$
declare
  v_field text;
  v_target_id uuid;
  v_session_campaign_id uuid;
  v_target_campaign_id uuid;
  v_target_ids uuid[];
  v_id uuid;
begin
  if new.type not in ('damage', 'heal', 'condition', 'attack', 'loot', 'move', 'cast', 'death') then
    return new;
  end if;

  select campaign_id into v_session_campaign_id
  from public.sessions
  where id = new.session_id;

  if new.type = 'cast' then
    begin
      v_target_id := (new.payload ->> 'casterId')::uuid;
    exception when others then
      raise exception 'event type cast requires a uuid payload.casterId';
    end;

    if v_target_id is null then
      raise exception 'event type cast requires payload.casterId';
    end if;

    select campaign_id into v_target_campaign_id
    from public.characters
    where id = v_target_id;

    if v_target_campaign_id is null then
      raise exception 'casterId % does not reference an existing character', v_target_id;
    end if;

    if v_target_campaign_id != v_session_campaign_id then
      raise exception 'casterId % belongs to a different campaign than this session', v_target_id;
    end if;

    begin
      select array_agg((elem)::uuid) into v_target_ids
      from jsonb_array_elements_text(new.payload -> 'targetIds') as elem;
    exception when others then
      raise exception 'event type cast requires payload.targetIds to be an array of uuids';
    end;

    if v_target_ids is null or array_length(v_target_ids, 1) is null then
      raise exception 'event type cast requires at least one payload.targetIds entry';
    end if;

    foreach v_id in array v_target_ids loop
      select campaign_id into v_target_campaign_id
      from public.characters
      where id = v_id;

      if v_target_campaign_id is null then
        raise exception 'targetIds entry % does not reference an existing character', v_id;
      end if;

      if v_target_campaign_id != v_session_campaign_id then
        raise exception 'targetIds entry % belongs to a different campaign than this session', v_id;
      end if;
    end loop;

    return new;
  end if;

  v_field := case when new.type = 'move' then 'actorId' else 'targetId' end;

  begin
    v_target_id := (new.payload ->> v_field)::uuid;
  exception when others then
    raise exception 'event type % requires a uuid payload.%', new.type, v_field;
  end;

  if v_target_id is null then
    raise exception 'event type % requires payload.%', new.type, v_field;
  end if;

  select campaign_id into v_target_campaign_id
  from public.characters
  where id = v_target_id;

  if v_target_campaign_id is null then
    raise exception '% % does not reference an existing character', v_field, v_target_id;
  end if;

  if v_target_campaign_id != v_session_campaign_id then
    raise exception '% % belongs to a different campaign than this session', v_field, v_target_id;
  end if;

  return new;
end;
$$;

-- Takes no arguments on purpose — the only account it can ever delete is the
-- caller's own. Everything else cascades from the auth.users row.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  delete from auth.users where id = v_uid;
end;
$$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;

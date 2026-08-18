-- =============================================================================
-- Ember — validate cast's caster/targets, let players cast their own spells
-- =============================================================================
-- cast didn't get the target-validation treatment when it shipped (see
-- 0004/0005/0007/0008) because its shape doesn't fit the single-targetId
-- pattern: casterId is one uuid, but targetIds is an array. This adds a
-- dedicated branch for 'cast' that checks casterId the same way every
-- other type's actor/target field is checked, plus every entry in
-- targetIds — all against the session's campaign.
--
-- Also widens events_insert_player_self_action (0006/0008) so a player can
-- cast where they own the caster — the same "act on your own character"
-- shape as attack and move. Targets can be anyone, same reasoning as
-- attack: that's the point of casting at someone.
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
  if new.type not in ('damage', 'heal', 'condition', 'attack', 'loot', 'move', 'cast') then
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

drop policy "events_insert_player_self_action" on public.events;

create policy "events_insert_player_self_action"
  on public.events for insert
  to authenticated
  with check (
    public.is_campaign_member(public.session_campaign_id(session_id))
    and (
      (type = 'attack' and public.owns_character(public.payload_uuid(payload, 'attackerId')))
      or (type = 'move' and public.owns_character(public.payload_uuid(payload, 'actorId')))
      or (type = 'cast' and public.owns_character(public.payload_uuid(payload, 'casterId')))
      or (
        type in ('damage', 'heal', 'condition')
        and public.owns_character(public.payload_uuid(payload, 'targetId'))
      )
    )
  );

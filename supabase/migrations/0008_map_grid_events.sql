-- =============================================================================
-- Ember — map/grid events: validate move's actor, let players move themselves
-- =============================================================================
-- move carries actorId instead of targetId, but means the same thing for
-- validation purposes: the character must exist and belong to the same
-- campaign as the event's session. Same trigger, widened to check the
-- right field name per type instead of always 'targetId'.
--
-- Also widens events_insert_player_self_action (0006) so a player can move
-- their own character — the same "act on your own character" shape as
-- attack, just for position instead of a die roll. Placing terrain stays
-- DM-only: that's the DM's map authority (DM Console Panels §4), not
-- something a player self-acts on.
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
begin
  if new.type not in ('damage', 'heal', 'condition', 'attack', 'loot', 'move') then
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

  select campaign_id into v_session_campaign_id
  from public.sessions
  where id = new.session_id;

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
      or (
        type in ('damage', 'heal', 'condition')
        and public.owns_character(public.payload_uuid(payload, 'targetId'))
      )
    )
  );

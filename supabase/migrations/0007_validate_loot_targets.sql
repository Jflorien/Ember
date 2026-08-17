-- =============================================================================
-- Ember — extend event target validation to loot events
-- =============================================================================
-- loot payloads carry a targetId with the exact same meaning as
-- damage/heal/condition/attack (0004/0005): the character receiving the
-- loot must exist and belong to the same campaign as the event's session.
-- Same function, same trigger — just widening the type list again.
-- =============================================================================

create or replace function public.validate_event_target()
returns trigger
language plpgsql
as $$
declare
  v_target_id uuid;
  v_session_campaign_id uuid;
  v_target_campaign_id uuid;
begin
  if new.type not in ('damage', 'heal', 'condition', 'attack', 'loot') then
    return new;
  end if;

  begin
    v_target_id := (new.payload ->> 'targetId')::uuid;
  exception when others then
    raise exception 'event type % requires a uuid payload.targetId', new.type;
  end;

  if v_target_id is null then
    raise exception 'event type % requires payload.targetId', new.type;
  end if;

  select campaign_id into v_session_campaign_id
  from public.sessions
  where id = new.session_id;

  select campaign_id into v_target_campaign_id
  from public.characters
  where id = v_target_id;

  if v_target_campaign_id is null then
    raise exception 'targetId % does not reference an existing character', v_target_id;
  end if;

  if v_target_campaign_id != v_session_campaign_id then
    raise exception 'targetId % belongs to a different campaign than this session', v_target_id;
  end if;

  return new;
end;
$$;

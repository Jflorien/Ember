-- =============================================================================
-- Ember — validate event targets
-- =============================================================================
-- The first real piece of "a deterministic rules engine validates them"
-- beyond zod shape checking. Nothing today stops a damage/heal/condition
-- event from naming a targetId that doesn't exist, or that names a real
-- character from a *different* campaign entirely — the insert would still
-- succeed, the event would just sit there doing nothing (CharacterHp/
-- CharacterConditions filter by targetId, so a bogus one folds into
-- nobody's state) or, worse, silently target the wrong character if a UUID
-- ever collided across campaigns.
--
-- Enforced here rather than only in src/app/dm/actions.ts for the same
-- reason seq assignment and RLS live in Postgres: application code is one
-- bypassable path to this table, not the only one, and this is exactly the
-- kind of invariant that needs to hold no matter what proposes the event —
-- a human, a bug, or eventually a model.
-- =============================================================================

create function public.validate_event_target()
returns trigger
language plpgsql
as $$
declare
  v_target_id uuid;
  v_session_campaign_id uuid;
  v_target_campaign_id uuid;
begin
  if new.type not in ('damage', 'heal', 'condition') then
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

create trigger events_validate_target
  before insert on public.events
  for each row
  execute function public.validate_event_target();

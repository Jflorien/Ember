-- =============================================================================
-- Ember — let players insert self-scoped events
-- =============================================================================
-- Until now, `events_insert_dm_only` (0001_init.sql) meant the DM console
-- was the *only* surface that could write to the event log — every other
-- surface just watched. That's a real gap: the point of a shared event
-- stream is that every device can act on it, not just the DM's. A player
-- should be able to roll their own attack, or self-report taking damage,
-- healing, or picking up a condition, from their own phone.
--
-- This is additive, not a replacement — RLS combines multiple permissive
-- policies for the same operation with OR, so `events_insert_dm_only`
-- still stands untouched and the DM keeps full authority over everything.
-- This policy only widens who else can write, and only for two narrow,
-- self-scoped cases:
--   - attack:  the proposing player owns the attacking character (attackerId).
--              The target can be anyone — that's the point of attacking.
--   - damage/heal/condition: the proposing player owns the character the
--              event targets (targetId) — "this happened to me," not "I did
--              this to someone else." Applying damage/healing/conditions to
--              another character is still DM-only for now.
-- =============================================================================

-- True if the current user owns the given character. Mirrors is_campaign_dm's
-- shape (security definer, so this can't recurse into characters' own RLS).
create function public.owns_character(p_character_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.characters
    where id = p_character_id and owner_id = auth.uid()
  );
$$;

-- Safely reads a uuid out of an event payload, returning null instead of
-- raising on a missing key or malformed value — this runs inside an RLS
-- check, where a hard error would surface as a confusing insert failure
-- instead of a clean "not allowed."
create function public.payload_uuid(p_payload jsonb, p_key text)
returns uuid
language plpgsql
immutable
as $$
begin
  return (p_payload ->> p_key)::uuid;
exception when others then
  return null;
end;
$$;

create policy "events_insert_player_self_action"
  on public.events for insert
  to authenticated
  with check (
    public.is_campaign_member(public.session_campaign_id(session_id))
    and (
      (type = 'attack' and public.owns_character(public.payload_uuid(payload, 'attackerId')))
      or (
        type in ('damage', 'heal', 'condition')
        and public.owns_character(public.payload_uuid(payload, 'targetId'))
      )
    )
  );

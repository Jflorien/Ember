-- =============================================================================
-- Ember — event sequencing + realtime
-- =============================================================================
-- Two things needed for "one event end-to-end" (CLAUDE.md's roadmap item 2):
--
-- 1. `seq` has to be gap-free per session without every caller doing its own
--    read-then-insert race. A BEFORE INSERT trigger assigns it server-side,
--    serialized per session via a transaction-scoped advisory lock — safe
--    under Supavisor's transaction-mode pooling, unlike a session-scoped
--    lock, which a pooled connection could hand to an unrelated transaction
--    before it's released. Callers never set `seq` themselves; the
--    events_session_seq_unique constraint from 0001 is the backstop if this
--    trigger is ever bypassed.
--
-- 2. Realtime only fans out changes on tables added to the `supabase_realtime`
--    publication. `events` needs to be on it for the DM console/table/player
--    app to receive commits live instead of polling. Realtime's
--    postgres_changes filters through RLS on the subscribing client's own
--    role, so this only adds delivery — it doesn't widen who can see what.
-- =============================================================================

create function public.assign_event_seq()
returns trigger
language plpgsql
as $$
begin
  perform pg_advisory_xact_lock(hashtext(new.session_id::text));

  select coalesce(max(seq), 0) + 1
  into new.seq
  from public.events
  where session_id = new.session_id;

  return new;
end;
$$;

create trigger events_assign_seq
  before insert on public.events
  for each row
  when (new.seq is null)
  execute function public.assign_event_seq();

alter publication supabase_realtime add table public.events;

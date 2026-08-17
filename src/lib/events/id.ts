import { monotonicFactory } from "ulid";

/**
 * ULIDs, not UUIDs: GameEvent.id needs to be lexically sortable by creation
 * time (see the `id` field comment on GameEvent in CLAUDE.md and on the
 * `events` table in supabase/migrations/0001_init.sql). The monotonic
 * factory guarantees strictly increasing ids even for events generated
 * within the same millisecond, which a plain `ulid()` call does not.
 */
const ulid = monotonicFactory();

export function newEventId(): string {
  return ulid();
}

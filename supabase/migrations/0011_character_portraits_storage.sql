-- =============================================================================
-- Ember — character portrait uploads (Supabase Storage)
-- =============================================================================
-- `characters.portrait_url` has existed since 0001_init.sql with nothing to
-- populate it. This adds a real Storage bucket for it: one object per
-- character, path `<character_id>/portrait.<ext>`, uploaded by
-- updateCharacterPortrait (src/app/dm/actions.ts) via the server-side
-- Supabase client — never the browser client directly, so the same
-- server-action-does-everything shape every other write in this app uses.
--
-- The bucket is public (portraits aren't sensitive) — reads never need RLS,
-- served straight off the CDN URL. Writes are RLS-gated the same way
-- `owns_character` already gates player-self-action events (0006): only the
-- character's owner can upload, replace, or delete its portrait. The path's
-- first segment is the character id, checked with storage.foldername.
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('character-portraits', 'character-portraits', true)
on conflict (id) do nothing;

create policy "character_portraits_read_public"
  on storage.objects for select
  to public
  using (bucket_id = 'character-portraits');

create policy "character_portraits_write_owner"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'character-portraits'
    and public.owns_character(((storage.foldername(name))[1])::uuid)
  );

create policy "character_portraits_update_owner"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'character-portraits'
    and public.owns_character(((storage.foldername(name))[1])::uuid)
  );

create policy "character_portraits_delete_owner"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'character-portraits'
    and public.owns_character(((storage.foldername(name))[1])::uuid)
  );

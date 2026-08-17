-- =============================================================================
-- Ember — initial schema
-- =============================================================================
--
-- HIDDEN INFORMATION RULE
-- ------------------------------------------------------------------------------
-- The whole point of `events` is that different people at the same table are
-- allowed to see different things at the same time (a DM's secret monster
-- HP, a player's private insight check, a trap only one character noticed).
-- We encode that as a `visibility` column on every event row instead of
-- keeping secrets out of the database entirely, so the DM console can still
-- show its own history and undo stack.
--
--   visibility = 'public'         -> readable by any member of the campaign
--                                    the event's session belongs to.
--   visibility = 'dm_only'        -> readable ONLY by the campaign's DM
--                                    (the membership row with role = 'dm',
--                                    or the campaign owner).
--   visibility = 'player:<uuid>'  -> readable by the campaign's DM AND the
--                                    single player whose user id matches
--                                    <uuid>. No one else — not even other
--                                    players — can read it.
--
-- All of this is enforced with Postgres row-level security below, not in
-- application code, so it holds even if a client is compromised or a future
-- surface forgets to filter. `anon`/`authenticated` roles only ever get rows
-- back that `auth.uid()` is entitled to see.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- users — profile row mirroring auth.users
-- ---------------------------------------------------------------------------
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.users enable row level security;

create policy "users_select_all_authenticated"
  on public.users for select
  to authenticated
  using (true);

create policy "users_insert_self"
  on public.users for insert
  to authenticated
  with check (id = auth.uid());

create policy "users_update_self"
  on public.users for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Auto-create a public.users row whenever a new auth.users row appears.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', new.email),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- campaigns
-- ---------------------------------------------------------------------------
create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users (id) on delete cascade,
  name text not null,
  ruleset text not null default 'srd-5.2.1',
  dm_mode text not null default 'human' check (dm_mode in ('human', 'ai')),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index campaigns_owner_id_idx on public.campaigns (owner_id);

alter table public.campaigns enable row level security;

-- ---------------------------------------------------------------------------
-- memberships
-- ---------------------------------------------------------------------------
create table public.memberships (
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  role text not null check (role in ('dm', 'player', 'spectator')),
  joined_at timestamptz not null default now(),
  primary key (campaign_id, user_id)
);

create index memberships_user_id_idx on public.memberships (user_id);
create index memberships_campaign_id_idx on public.memberships (campaign_id);

alter table public.memberships enable row level security;

-- ---------------------------------------------------------------------------
-- sessions
-- ---------------------------------------------------------------------------
-- Table only, here — RLS and policies are defined further down, after the
-- helper functions below (is_campaign_member/is_campaign_dm) exist. The
-- table itself has to exist before this point, though: session_campaign_id()
-- is a `language sql` function, and Postgres resolves the relations a SQL
-- function body references at CREATE FUNCTION time, not at call time.
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'active', 'paused', 'ended')),
  started_at timestamptz,
  ended_at timestamptz,
  current_round integer not null default 0,
  created_at timestamptz not null default now()
);

create index sessions_campaign_id_idx on public.sessions (campaign_id);

-- ---------------------------------------------------------------------------
-- Helper functions (security definer, used inside RLS policies)
-- ---------------------------------------------------------------------------

-- True if the current user owns or has any membership in the campaign.
create function public.is_campaign_member(p_campaign_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.campaigns c
    where c.id = p_campaign_id and c.owner_id = auth.uid()
  ) or exists (
    select 1 from public.memberships m
    where m.campaign_id = p_campaign_id and m.user_id = auth.uid()
  );
$$;

-- True if the current user is the DM of the campaign (owner or role = 'dm').
create function public.is_campaign_dm(p_campaign_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.campaigns c
    where c.id = p_campaign_id and c.owner_id = auth.uid()
  ) or exists (
    select 1 from public.memberships m
    where m.campaign_id = p_campaign_id
      and m.user_id = auth.uid()
      and m.role = 'dm'
  );
$$;

-- Campaign id that a given session belongs to.
create function public.session_campaign_id(p_session_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select s.campaign_id from public.sessions s where s.id = p_session_id;
$$;

-- ---------------------------------------------------------------------------
-- campaigns policies (defined after helper functions exist)
-- ---------------------------------------------------------------------------
create policy "campaigns_select_members"
  on public.campaigns for select
  to authenticated
  using (owner_id = auth.uid() or public.is_campaign_member(id));

create policy "campaigns_insert_owner"
  on public.campaigns for insert
  to authenticated
  with check (owner_id = auth.uid());

create policy "campaigns_update_owner"
  on public.campaigns for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "campaigns_delete_owner"
  on public.campaigns for delete
  to authenticated
  using (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- memberships policies
-- ---------------------------------------------------------------------------
create policy "memberships_select_members"
  on public.memberships for select
  to authenticated
  using (
    user_id = auth.uid() or public.is_campaign_member(campaign_id)
  );

create policy "memberships_insert_owner_or_dm"
  on public.memberships for insert
  to authenticated
  with check (public.is_campaign_dm(campaign_id));

create policy "memberships_update_owner_or_dm"
  on public.memberships for update
  to authenticated
  using (public.is_campaign_dm(campaign_id))
  with check (public.is_campaign_dm(campaign_id));

create policy "memberships_delete_owner_or_dm_or_self"
  on public.memberships for delete
  to authenticated
  using (public.is_campaign_dm(campaign_id) or user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- characters
-- ---------------------------------------------------------------------------
create table public.characters (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  owner_id uuid not null references public.users (id) on delete cascade,
  name text not null,
  class text,
  level integer not null default 1 check (level between 1 and 20),
  sheet jsonb not null default '{}'::jsonb,
  portrait_url text,
  created_at timestamptz not null default now()
);

create index characters_campaign_id_idx on public.characters (campaign_id);
create index characters_owner_id_idx on public.characters (owner_id);

alter table public.characters enable row level security;

create policy "characters_select_campaign_members"
  on public.characters for select
  to authenticated
  using (public.is_campaign_member(campaign_id));

create policy "characters_insert_owner_or_dm"
  on public.characters for insert
  to authenticated
  with check (
    owner_id = auth.uid() and public.is_campaign_member(campaign_id)
  );

create policy "characters_update_owner_or_dm"
  on public.characters for update
  to authenticated
  using (owner_id = auth.uid() or public.is_campaign_dm(campaign_id))
  with check (owner_id = auth.uid() or public.is_campaign_dm(campaign_id));

create policy "characters_delete_owner_or_dm"
  on public.characters for delete
  to authenticated
  using (owner_id = auth.uid() or public.is_campaign_dm(campaign_id));

-- ---------------------------------------------------------------------------
-- sessions policies (table itself is created above, before the helper
-- functions — see the comment there)
-- ---------------------------------------------------------------------------
alter table public.sessions enable row level security;

create policy "sessions_select_campaign_members"
  on public.sessions for select
  to authenticated
  using (public.is_campaign_member(campaign_id));

create policy "sessions_insert_dm"
  on public.sessions for insert
  to authenticated
  with check (public.is_campaign_dm(campaign_id));

create policy "sessions_update_dm"
  on public.sessions for update
  to authenticated
  using (public.is_campaign_dm(campaign_id))
  with check (public.is_campaign_dm(campaign_id));

create policy "sessions_delete_dm"
  on public.sessions for delete
  to authenticated
  using (public.is_campaign_dm(campaign_id));

-- ---------------------------------------------------------------------------
-- events — the authoritative, append-only game log
-- ---------------------------------------------------------------------------
create table public.events (
  -- ULID, generated by whichever surface proposes the event (DM console or
  -- the model), not by Postgres — see src/lib/events/id.ts. Globally unique
  -- and lexically sortable by creation time; `seq` is still the authoritative
  -- gap-free ordering key within a session.
  id text primary key,
  session_id uuid not null references public.sessions (id) on delete cascade,
  seq integer not null,
  type text not null,
  actor uuid references public.users (id),
  payload jsonb not null default '{}'::jsonb,
  visibility text not null default 'public',
  -- Was this event proposed by a human (typed into the DM console) or by the
  -- model (the AI DM)? Not "which user" — every insert is already scoped to
  -- the campaign DM by the events_insert_dm_only policy below.
  proposed_by text not null,
  committed_at timestamptz not null default now(),
  constraint events_id_ulid_check check (id ~ '^[0-7][0-9A-HJKMNP-TV-Z]{25}$'),
  constraint events_visibility_check check (
    visibility = 'public'
    or visibility = 'dm_only'
    or visibility ~ '^player:[0-9a-fA-F-]{36}$'
  ),
  constraint events_proposed_by_check check (proposed_by in ('human', 'model')),
  constraint events_session_seq_unique unique (session_id, seq)
);

create index events_session_id_seq_idx on public.events (session_id, seq);

alter table public.events enable row level security;

-- Extracts the uuid out of a 'player:<uuid>' visibility value.
create function public.event_visibility_player(p_visibility text)
returns uuid
language sql
immutable
as $$
  select case
    when p_visibility like 'player:%'
      then substring(p_visibility from 8)::uuid
    else null
  end;
$$;

-- SELECT: any campaign member can read 'public' events for a session in
-- their campaign. 'dm_only' events are readable only by that campaign's DM.
-- 'player:<uuid>' events are readable only by the DM and the named player.
create policy "events_select_visibility_scoped"
  on public.events for select
  to authenticated
  using (
    public.is_campaign_member(public.session_campaign_id(session_id))
    and (
      visibility = 'public'
      or (
        visibility = 'dm_only'
        and public.is_campaign_dm(public.session_campaign_id(session_id))
      )
      or (
        visibility like 'player:%'
        and (
          public.is_campaign_dm(public.session_campaign_id(session_id))
          or auth.uid() = public.event_visibility_player(visibility)
        )
      )
    )
  );

-- INSERT: only the campaign DM commits events. `proposed_by` may be the DM
-- (human) or any campaign member acting through the DM's approval flow —
-- application logic decides that; RLS just requires the DM to be the one
-- writing the row, keeping the log's authority with the DM console.
create policy "events_insert_dm_only"
  on public.events for insert
  to authenticated
  with check (
    public.is_campaign_dm(public.session_campaign_id(session_id))
  );

-- Events are an append-only log: no update or delete policies are defined,
-- so both are denied by default under RLS.

-- ---------------------------------------------------------------------------
-- updated_at-less by design: campaigns/characters/sessions/events all use
-- created_at/committed_at only, matching the append-oriented event model.
-- ---------------------------------------------------------------------------

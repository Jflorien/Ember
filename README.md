# Ember

Ember is an AI-assisted tabletop engine for D&D. A single authoritative game
state — an append-only log of `GameEvent`s validated by a rules engine — feeds
three surfaces: a console for the DM, a sheet for every player, and a living
map for the TV. This repo is the product scaffold: marketing site, auth, and
the route shells for those three surfaces, wired to Supabase.

## Stack

- Next.js 15 (App Router, TypeScript, `src/` dir)
- Tailwind CSS v3 (hand-written design system, no component library)
- Supabase (`@supabase/supabase-js` + `@supabase/ssr`) for auth and Postgres

## Setup

1. **Create a Supabase project** at [supabase.com](https://supabase.com).
2. **Run the migrations** against it — either paste each file in
   `supabase/migrations/` into the SQL editor **in numeric order**, or,
   with the [Supabase CLI](https://supabase.com/docs/guides/cli) linked to
   your project:

   ```bash
   supabase db push
   ```

3. **Enable OAuth providers** you want to offer (Discord, Google) under
   Authentication → Providers, and add `<your-site-url>/auth/callback` as a
   redirect URL for each.
4. **Set environment variables** — copy `.env.example` to `.env.local` and
   fill in your project's URL and anon key from Project Settings → API:

   ```bash
   cp .env.example .env.local
   ```

5. **Install and run**:

   ```bash
   npm install
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

`npm run build` and `npm run lint` both work with **no** `.env` file present
— Supabase env vars are read lazily and only throw when a Supabase client is
actually constructed at request time, not at build time.

## Route map

| Route                    | Description                                            | Auth        |
| ------------------------- | ------------------------------------------------------- | ----------- |
| `/`                        | Marketing homepage                                       | Public      |
| `/login`                   | Email/password + Discord/Google OAuth login              | Public      |
| `/login/forgot-password`   | Password reset request                                   | Public      |
| `/signup`                  | Account creation                                          | Public      |
| `/auth/callback`           | OAuth / magic-link code exchange (route handler)          | —           |
| `/dm`                      | DM console shell                                          | Required    |
| `/play`                    | Player app shell                                          | Required    |
| `/table`                   | Chrome-free table view (TV)                                | Public      |

Root `middleware.ts` refreshes the Supabase session on every request and
redirects unauthenticated users away from `/dm` and `/play` to `/login`.

## Database

`supabase/migrations/0001_init.sql` creates `users`, `campaigns`,
`memberships`, `characters`, `sessions`, and `events`, with row-level
security on every table. The key rule: `events.visibility` controls who can
read a row —

- `public` — any member of the event's campaign
- `dm_only` — the campaign's DM only
- `player:<uuid>` — the DM and that one player only

See the comment block at the top of the migration for the full rationale.
`events` also has a unique constraint + index on `(session_id, seq)` so
event ordering within a session is enforced at the database level.

Writes are RLS-gated too: the DM can insert anything, and — since
`0006_player_self_action_events.sql` — a non-DM campaign member can
additionally insert an `attack` event where they own the attacker, or a
`damage`/`heal`/`condition` event where they own the target. Nothing else,
and never on behalf of a character they don't own.

## What's not built yet

- The real DM console, player sheet, and table-view UI beyond a first pass.
  `/dm` is now organized into named panels (Session Setup, Turn Control,
  Party, Event Console, Live Table, Session Log) matching the Notion
  `DM Console Panels` spec, and a map/grid primitive is real now (see below)
  — but Encounter Staging, NPC/monster management, and the AI co-pilot panel
  are still blocked on systems that don't exist (a stat-block system, the AI
  DM itself). `/play`'s Core Character Stats panel is HP + conditions only —
  ability scores, saves, and passive perception have no data model yet, and
  Actions & Spells has real spell content behind it now (see below) but no
  spell *browser* UI on `/play` yet.
- Most of the rules engine — `src/app/dm/actions.ts` validates a proposed
  event's *shape* via zod, and a database trigger
  (`supabase/migrations/0004_validate_event_targets.sql`, widened to cover
  `attack` in `0005`, `loot` in `0007`, `move` in `0008`, and `cast` in
  `0010`) rejects a `damage`/`heal`/`condition`/`attack`/`loot` event whose
  target isn't a real character in the same campaign, a `move` event whose
  actor isn't, or a `cast` event whose caster or any target isn't (`cast`
  needed its own branch — `targetIds` is an array, not a single
  `targetId`), but nothing checks legality beyond that (e.g. that an
  attack's target is in range, that a hit actually deals damage, or that a
  caster has the spell slot it's spending — all still separate manual
  steps or unenforced). `narration`, `damage`, `heal`, `condition`,
  `attack`, `round`, `loot`, `terrain`, `move`, `cast`, `destroy`, and
  `reveal` events have a UI now; only `death` is still unused (needs a
  real "character is down" state, distinct from the existing
  `unconscious` condition pill). `reveal`'s *map-area* half (the `area`
  field) is wired but unused — that's fog of war, which needs cells to
  have a default-hidden state per player first. A player can propose
  their own `attack`, `move`, or `cast` (not just self-report
  `damage`/`heal`/`condition`) via `events_insert_player_self_action` —
  see `PlayerActionPanel` and `CastComposer` on `/play`.
  Spells are real: `spells` (`supabase/migrations/0009_spells.sql`), global
  reference data — 15 real SRD 5.2.1 spells plus one original
  (`source: 'srd' | 'original'`), no per-character known-spells list or
  slot tracking, so any caster can pick any spell freely. A map/grid
  primitive backs `terrain`/`move`/`destroy`: no new tables, terrain and
  character position are both folds over committed events, same as
  everything else — `destroy` folds by clearing a cell, which is also
  the only way a placed cell gets removed (there's no separate "clear"
  action). `MapGrid` (`src/components/map-grid.tsx`) is read-only on
  `/table` and interactive on `/dm` (`MapControlPanel`) via a
  Move/Terrain/Destroy mode toggle over a fixed 16×10 grid — no map
  upload/resize yet. Dice are rolled server-side via a seeded PRNG
  (`src/lib/dice.ts`) — the seed and every raw roll are committed as part of
  the event payload, so an attack roll is auditable without a separate log.
  The round counter (`RoundTracker` on `/dm`, read-only `RoundBadge` on
  `/table` and `/play`) is folded from committed `round` events the same way
  HP is — nothing stores "what round is it." Every DM-side composer also has
  a per-event visibility control (`public`/`dm_only`/`player:<uuid>`,
  `src/components/visibility-select.tsx`) and `dm_only` events can be
  revealed to the party as a new public event without mutating the hidden
  one — the log stays append-only either way.
- Promoting a member to co-DM. `MemberManagement` on `/dm` covers kicking a
  member and switching them between `player`/`spectator`, and
  `InviteCodeDisplay` can regenerate the invite code, but the role select
  deliberately doesn't offer `dm` — the memberships RLS would technically
  allow it, but granting co-DM authority is a bigger decision than this
  panel is scoped for. A campaign/character picker also exists now
  (`CampaignSwitcher` on `/dm` and `/play`, plus a target `<select>` in the
  DM console ahead of the damage/heal/condition composers), so a user with
  multiple campaigns can switch between them and the DM can target any
  character, not just the first one created.
- Spell slots and inventory on the character sheet. Class and level are real
  now (`characters.class`/`.level`, set at creation and shown in `/play`'s
  Session Header), and so are ability scores, AC, speed, saving throw
  proficiencies, and passive perception (`src/lib/characters/sheet.ts`,
  rendered by `CoreCharacterStats` on `/play`) — race, skills/proficiencies,
  and equipment/gold still aren't. Character creation assigns the SRD
  standard array only; point buy and rolling aren't built. Characters can
  now have a real portrait (`character-portraits` Storage bucket, RLS-gated
  to the character's owner), shown on the sheet and every Party Status Strip
  tile with an initials fallback when there isn't one yet.
- The AI dungeon master itself. A narration co-pilot exists (`ANTHROPIC_API_KEY`, see
  `.env.example`) — the DM types what should happen and Claude drafts narration text from the
  campaign's recent event log, but it only suggests prose: it never rolls dice, adjudicates, or
  proposes a mechanical event on its own. Sending its suggestion unedited tags the resulting
  event `proposed_by: "model"`; editing it (or writing narration from scratch) tags it `"human"`.
- `/login/forgot-password` calls a real `resetPasswordForEmail` server
  action, but there's no corresponding "set new password" page for the
  callback to land on yet.
- Email capture on the homepage CTA is intentionally non-functional (styled
  only, per spec) — it doesn't post anywhere.
- No automated tests.

## Fonts

The design system specifies **Cinzel** (display), **Inter** (UI) and **JetBrains Mono** (data).
They are wired as CSS variables `--f-display` / `--f-ui` / `--f-mono` in `globals.css` and
currently resolve to system fallbacks, because the build sandbox has no access to
`fonts.googleapis.com`.

To switch to the real faces on your machine, add to `src/app/layout.tsx`:

```ts
import { Cinzel, Inter, JetBrains_Mono } from "next/font/google";

const display = Cinzel({ subsets: ["latin"], weight: ["700"], variable: "--font-display" });
const ui      = Inter({ subsets: ["latin"], weight: ["400","600","700"], variable: "--font-ui" });
const mono    = JetBrains_Mono({ subsets: ["latin"], weight: ["500","600","700"], variable: "--font-mono" });
```

Put `${display.variable} ${ui.variable} ${mono.variable}` on `<html>`, then in `globals.css`
point the tokens at them:

```css
--f-display: var(--font-display), "Iowan Old Style", Georgia, serif;
--f-ui:      var(--font-ui), -apple-system, "Segoe UI", Roboto, sans-serif;
--f-mono:    var(--font-mono), ui-monospace, Menlo, monospace;
```

Nothing else needs to change — every component reads the tokens, not the families.

## A note on AGENTS.md

`next dev` auto-generates an untracked `AGENTS.md` at the repo root, telling coding agents to read
`node_modules/next/dist/docs/` before writing code. That directory doesn't exist in this install, so
the instruction is inert — and since it's regenerated on every `next dev` run, deleting it doesn't
stick. Safe to ignore; it's already untracked and gitignored-in-spirit.

This is unrelated to `CLAUDE.md` at the repo root, which is this project's real, hand-maintained
instructions file (architecture, conventions, working agreements) — keep that one.

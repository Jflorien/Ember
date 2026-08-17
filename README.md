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

## What's not built yet

- The real DM console, player sheet, and table-view UI — `/dm`, `/play`, and
  `/table` currently only prove the event pipeline, a live character sheet
  (HP + conditions), and a Party Status Strip; they're not the panel
  layouts from the design docs yet.
- Most of the rules engine — `src/app/dm/actions.ts` validates a proposed
  event's *shape* via zod, and a database trigger
  (`supabase/migrations/0004_validate_event_targets.sql`) now rejects a
  `damage`/`heal`/`condition` event whose target isn't a real character in
  the same campaign, but nothing checks legality beyond that (e.g. that an
  attack's target is in range). Only `narration`, `damage`, `heal`, and
  `condition` events have a UI; the other 9 types in
  `src/lib/events/schema.ts` are unused so far.
- A campaign/character *picker* — creation and joining are real now
  (`/dm` and `/play` show forms instead of auto-creating), but a user with
  more than one campaign only ever sees their most recently created one,
  and the DM console's damage/heal/condition composers always target
  whichever character was created first in the campaign, not a chosen one.
  There's also no member-management UI (kick, change role, regenerate an
  invite code) once someone's joined.
- Spell slots and inventory on the character sheet.
- The AI dungeon master itself.
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

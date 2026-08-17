# Ember

An AI-run tabletop RPG. One authoritative game state, three surfaces onto it, and a dungeon
master that can be a person or a model without the rest of the system knowing the difference.

Working name only — "Ember" has not been trademark-checked.

---

## Commands

```bash
npm run dev      # dev server
npm run build    # must pass before any commit
npm run lint     # must pass before any commit
```

Environment: copy `.env.example` to `.env.local` and fill in Supabase URL + anon key.
The build is designed to succeed with no env vars set (env is read lazily inside functions),
so never reintroduce module-level env reads.

---

## The one rule that matters

**Nothing calls a renderer or a UI surface directly.** The DM — human or model — *proposes*
events; a deterministic rules engine *validates* them; only committed events reach any surface.
Every panel, sheet, map and log is a subscriber to that stream.

```ts
type GameEvent = {
  id:          string        // ULID, monotonic — also the ordering key
  session_id:  string
  seq:         number        // gap-free per session; clients detect drops
  type:        'cast' | 'attack' | 'damage' | 'heal' | 'move' | 'condition'
             | 'terrain' | 'destroy' | 'death' | 'reveal' | 'loot'
             | 'narration' | 'round'
  actor:       string | null
  payload:     Json          // zod-validated per type, versioned
  visibility:  'public' | 'dm_only' | `player:${string}`
  proposed_by: 'human' | 'model'
  committed_at: string
}
```

### Four constraints that are never violated

1. **The model never holds game state.** Postgres does. The model gets a serialised snapshot
   per turn and proposes mutations. HP living in a context window drifts within 20 minutes.
2. **Hidden information never leaves the server.** If the boss has 140 HP left, that number must
   not be in a player client's memory and hidden with CSS. Enforced by RLS on `visibility`,
   never in the UI layer.
3. **The event log is append-only.** Undo is a compensating event, never a delete. `events` has
   no UPDATE or DELETE policy, so this is enforced by the database.
4. **Dice are rolled server-side.** Seeded, logged, auditable. Note this contradicts one page of
   the design doc — see `docs/notion-findings.md`. The server-authoritative reading wins.

---

## Repo layout

```
src/app/
  page.tsx              marketing homepage
  login/ signup/        auth, server actions in app/auth/actions.ts
  auth/callback/        OAuth code exchange
  dm/ play/ table/      the three surfaces — placeholder shells today
src/components/         nav, footer, auth-shell, hp-bar, slot-pips, condition-pill
src/lib/supabase/       client.ts (browser), server.ts, middleware.ts, env.ts
middleware.ts           session refresh + route protection for /dm and /play
supabase/migrations/    0001_init.sql — schema AND row-level security
docs/                   open these in a browser
```

### The three surfaces

| Route    | Device  | Role |
|----------|---------|------|
| `/dm`    | desktop | DM console. The only surface that writes authoritative events by hand. |
| `/play`  | phone   | Character sheet, inventory, slots, dice. Reads only what that player may see. |
| `/table` | TV      | Read-only render of committed events. No input, no hover, no chrome. |

Marketed as two products (DM tool, player app). Built as one codebase — during a live session
these surfaces must agree within milliseconds, and splitting the code means two implementations
of the hardest part, drifting apart.

---

## Design system

Full reference with live components: **`docs/design-system.html`** — open it in a browser before
building any UI.

The organising idea is **heat is state**. Cold basalt is the default — spent slots, inactive
turns, empty equipment, past log entries. Anything alive, available or happening is lit. Gold-hot
is reserved almost entirely for *it is your turn*.

This exists because the three surfaces are read at three distances, and the furthest is four
people looking at a TV across a room. Hue alone fails at that distance; luminance and glow
survive it.

### Non-negotiables

- **No rounded corners.** Every surface is chamfered top-left and bottom-right via `clip-path`.
  The `.plate` class is the primitive; its 1px gradient border is a masked `::before`, which is
  why the border survives the cut instead of being clipped with it.
- **Component classes go in `@layer components`, never `@layer utilities`.** If they land in
  utilities, `.plate` and `.btn` silently override utility classes applied in markup. This was a
  real bug in an earlier revision — `border-t-2 border-t-gold` computed to 1px grey.
- **Every changing number is `font-variant-numeric: tabular-nums`** in the mono face. An HP
  counter that reflows as it ticks reads as broken.
- **One heated element per view.** If two things glow, neither is the answer.
- **Never red/green for buff vs debuff** — the system uses green vs violet deliberately.
- **Never rely on colour alone.** Pair every signal with a label, shape or border weight; glow
  is lost on projectors.
- Molten is an accent, never body copy. Gold is turn state, concentration and legendary — nothing
  else. No parchment, no texture: the fantasy comes from light, not props.

Tokens live in `src/app/globals.css` `:root` and are mirrored into `tailwind.config.ts`.
Ramps: `basalt` (surfaces), `ash` (type), `molten` (heat), `forge` (highlight), `iron` (structure),
plus all 13 `--dt-*` damage types and 6 `--r-*` rarity levels.

### Fonts

Cinzel / Inter / JetBrains Mono, wired as `--f-display` / `--f-ui` / `--f-mono`. They currently
resolve to **system fallbacks** because the sandbox that generated this repo had no access to
`fonts.googleapis.com`. See README for the `next/font/google` block to paste in — every component
reads the tokens, so nothing else changes.

---

## Database

`supabase/migrations/0001_init.sql`. Tables: `users`, `campaigns`, `memberships`, `characters`,
`sessions`, `events`.

RLS is the security boundary, not the UI:

- A campaign is readable only by its owner or a member.
- `events.visibility = 'dm_only'` → readable only by that campaign's DM.
- `events.visibility = 'player:<uuid>'` → readable by the DM and that one player.
- `events` has no UPDATE/DELETE policy — append-only is enforced by the database.
- Characters: readable by all campaign members, writable by owner or DM.

RLS helpers (`is_campaign_member`, `is_campaign_dm`, `session_campaign_id`) are
`security definer` with `set search_path = public`. **Keep them that way** — without it, a
membership policy that queries `memberships` recurses infinitely. This is the most common
Supabase footgun and it is already handled.

---

## State of play

**Built:** auth (email + Discord + Google), marketing homepage, login/signup/forgot-password,
route shells, schema + RLS, design system applied.

**Not built:** realtime wiring, campaign/character CRUD, the rules engine, the event bus,
the three surfaces themselves, anything AI.

### Next, in order

1. **Schema → live.** Run the migration against a real Supabase project. Verify the RLS leak
   test by hand: log in as a player, try to select a `dm_only` event, confirm zero rows.
2. **One event end-to-end.** Two browsers, a button, a Realtime subscription, an event landing
   on both under 150ms. Everything in P1 is a variation on this.
3. **Automate the RLS leak test** so it runs in CI. Do this before there is hidden data to leak.
4. **Character sheet**, driven by the event stream — never polling.

Full requirements map with 116 tagged requirements and the phased plan: `docs/requirements-map.html`.

---

## Source of truth for game design

The ruleset, classes, races, spell lists, UI panel specs and AI DM prompt templates live in a
Notion wiki called **Side Project** (~80 pages). It is authoritative for *what the game is*;
this repo is authoritative for *how it is built*.

Important: the handbook contains **original classes and races**, not just SRD content —
Ash-Blooded, Stoneborn, Fae-Touched, Beastkin, Path of the Wildfire, Path of the Iron Howl,
College of Battlechants. The content model must support original classes and subclasses, not
just a seeded SRD dump.

Contradictions and gaps found in that doc — resolve before building the affected system:
`docs/notion-findings.md`.

---

## Working agreements

- `npm run build` and `npm run lint` both pass before any commit. Fix errors properly; never
  disable a rule to get green.
- Prefer editing tokens over hardcoding colours. If a colour is not in the palette, it does not
  go in the product.
- When adding an event type, add its zod schema and its RLS implications in the same change.
- Keep `docs/*.html` in sync when a decision changes — they are the shared reference, and they
  are the thing that gets shown to other people.

---

## Legal

Rules content is SRD 5.2.1 under CC BY 4.0 — commercially usable with attribution, which is
shipped in the footer. Not covered: the D&D name, IP-specific creatures (beholders, mind
flayers), published adventures, or anything imported from D&D Beyond. The DMG's encounter-budget
tables are **not** SRD content — an original difficulty formula is required.

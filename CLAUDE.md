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
route shells, schema + RLS (live on the `ember` Supabase project, RLS leak-tested both by hand
and automated in CI), design system applied, the `GameEvent` zod schema (`src/lib/events/`), a
full propose → validate → commit → Realtime slice for `narration`/`damage`/`heal`/`condition`
events (`src/app/dm/actions.ts`), a `before insert` trigger that assigns `seq` gap-free per
session (`supabase/migrations/0002_event_seq_and_realtime.sql`), real campaign/character creation
with invite-code joins (`supabase/migrations/0003_campaign_invites.sql`, `/join/[code]`,
replacing the old auto-provisioned "Demo campaign"/"Demo character"), and a character sheet where
nothing is stored — `useCharacterHp`/`useCharacterConditions` (`src/lib/hooks/`) each fold the
relevant events for a character into current state, live over Realtime, shared by `CharacterHp`/
`CharacterConditions` (the full sheet, on `/dm` and `/play`) and `PartyMemberTile` (the compact
Party Status Strip, showing every character in the campaign on both surfaces).

Also built, out of roadmap order — a visual pass on `/table`: `TvEventFeed`
(`src/components/tv-event-feed.tsx`) applies "heat is state" to recency instead of just
resources, the one place in the app that hadn't done that yet. Newest event large and
forge-hot, older ones shrinking and cooling toward ash/basalt as they recede — four tiers, size
*and* color both carrying the signal per the design system's "never rely on colour alone" rule.
Caught a real Tailwind gotcha doing it: `shadow-[var(--glow-md)]` silently compiles to a
shadow-*color* utility, not a full `box-shadow`, because Tailwind's arbitrary-value heuristic
reads the bracket contents as a color; the fix is the arbitrary-property form,
`[box-shadow:var(--glow-md)]`. Worth remembering anywhere else a CSS custom property holding a
full shadow value gets used as a Tailwind arbitrary value.

The rules engine has its first real check beyond zod shape validation: a `before insert` trigger
(`supabase/migrations/0004_validate_event_targets.sql`) rejects any `damage`/`heal`/`condition`
event whose `targetId` doesn't name a real character in the *same campaign* as the event's
session — enforced in Postgres, not `src/app/dm/actions.ts`, for the same reason `seq` assignment
and RLS live there: application code is one bypassable path to this table, not the only one.
Automated in CI (`supabase/tests/event_target_validation_test.sql`, same disposable-instance
pattern as the RLS leak test) alongside a live check against the real project.

A campaign/character picker now sits in front of both the DM console and the player app:
`CampaignSwitcher` (`src/components/campaign-switcher.tsx`) is a server component of plain
`<Link href="?campaign=<id>">`s — campaign switching is page navigation, not in-page state — shown
on `/dm` and `/play` whenever the signed-in user has one or more campaigns (`getMyDmCampaigns` /
`getMyPlayerCampaigns` in `src/app/dm/actions.ts`), with `getMyDmCampaign`/`getMyPlayerCampaign`
now taking an optional `campaignId` and falling back to most-recently-created when absent, so old
single-campaign links keep working. `/table` deliberately has no visible switcher — it stays
chrome-free per spec — but still honours `?campaign=<id>` for deep-linking. Inside a campaign,
`TargetedComposers` (`src/components/targeted-composers.tsx`) adds a `<select>` of the campaign's
characters ahead of the damage/heal/condition composers, defaulting to the first character but
letting the DM pick any of them as `targetId`, replacing the old hardcoded `members[0]`.

The `attack` event type is built end to end, and with it the first piece of CLAUDE.md's "Dice
are rolled server-side. Seeded, logged, auditable." constraint — previously true of nothing in
the codebase. `src/lib/dice.ts` draws from a `crypto.randomInt`-seeded `mulberry32` PRNG;
`proposeAttackEvent` (`src/app/dm/actions.ts`) is the only caller, so a client sends attacker/
target/modifier/advantage and never a die result, and the seed plus every raw roll (both dice
for advantage/disadvantage, not just the kept one) are committed as part of the payload — the
event log is the audit trail, not a separate one. Target AC is read from the target's own
`characters.sheet` (defaulting to 10, same fallback pattern as `maxHp`), never trusted from the
form. `AttackComposer` (`src/components/attack-composer.tsx`) adds a second picker — Attacker,
alongside the existing Target — to `TargetedComposers`. The event-target-validation trigger from
0004 was widened in `supabase/migrations/0005_validate_attack_targets.sql` to cover `attack`
too, since it carries the same `targetId` shape; `LiveEventFeed`/`TvEventFeed` both gained a
real attack description ("Attack: 19+15 = 34 vs AC 10 — Hit") via a shared `describeEvent`
(`src/lib/events/describe.ts`) that replaced the two components' duplicated narration-only
fallback. Caught a real bug live before shipping: `events.actor` is a foreign key to
`public.users` (the proposing *person*), not a character — the first version of
`proposeAttackEvent` set `actor: attackerId` and every insert failed
`events_actor_fkey`; fixed to `actor: null` like every other propose\*Event, since attackerId
already lives in the payload where it belongs.

The `round` event type tracks combat's round counter, folded live the same way HP and conditions
are — nothing stores "what round is it," `useSessionRound` (`src/lib/hooks/use-session-round.ts`)
derives it from the last committed `round` event. `RoundTracker` (`src/components/round-tracker.tsx`,
`/dm` only) is the single writer: its "Start/End round N" button calls `proposeAdvanceRoundEvent`,
which recomputes the next number/phase from the *last committed event in the database*, never
from client state, so a stale tab or two DMs clicking at once can't desync the count — the same
"don't trust the client" shape as attack's dice. `RoundBadge` (`src/components/round-badge.tsx`)
is the read-only half, shown on `/table` and `/play`; deliberately un-heated (ash, not gold) per
the design system's "gold is turn state... nothing else" — a whole-party round count isn't any
one character's turn. Verified live across all three surfaces at once (two tabs open side by
side): advancing from the DM console propagated to both `/table` and `/play` over Realtime with
no refresh, through a full start 1 → end 1 → start 2 cycle.

**Not built:** the rest of the rules engine (attack is one invariant plus one full event type,
not full legality — nothing yet checks a spell's components or whether a character has the
resource it's spending, and a hit still requires a manual follow-up damage event rather than
applying it automatically), the other 7 event types' UI (`move`, `cast`, etc.), spell slots and
inventory on the character sheet, the three surfaces' real designs beyond the `/table` visual
pass (DM console/player app are still single-purpose proof pages, not the panel layouts in
Notion's `DM Console Panels` / player UI spec), anything AI.

### Next, in order

1. ~~Schema → live.~~ Done — the migration ran into a real bug on first execution (see the
   `events_assign_seq` and table-privileges commits) that only surfaced once it was applied
   somewhere other than a dashboard-provisioned project. Fixed and verified.
2. ~~One event end-to-end.~~ Done. The Realtime half had its own real bug: the browser client's
   websocket authorizes independently of the REST client's session, and subscribing before
   `supabase.realtime.setAuth()` resolves leaves a window where `postgres_changes` silently
   applies RLS as an anonymous connection and delivers nothing — no error. Every hook in
   `src/lib/hooks/` that opens a Realtime channel repeats the same setAuth-before-subscribe fix.
3. ~~Automate the RLS leak test.~~ Done, runs in CI on every push — and caught a real regression
   later the same session (0003 made `invite_code` NOT NULL; the test's seed script didn't know
   yet). That's exactly the job it's there to do.
4. ~~Character sheet, driven by the event stream.~~ Done for HP and conditions. Spell slots and
   inventory still unbuilt (blocked on SRD content).
5. ~~Real campaign/character creation.~~ Done — verified live via the actual `/join/[code]` UI,
   with the RPC's own logic (idempotent double-join, bad-code rejection) verified at the SQL level
   using a simulated second user, the same technique as the RLS leak test — this project has had
   only one real Supabase auth user to test with the whole time.
6. ~~Party Status Strip.~~ Done — verified live on both `/dm` and `/play` with three characters in
   the same campaign (two seeded synthetically via SQL, same simulated-user technique, since
   there's still only one real account): correct HP per tile, and a condition applied through the
   DM console's composer showed up as a dot on the right tile, live, on both surfaces.
7. ~~Campaign/character picker.~~ Done. Verified live: created a second real campaign
   ("The Sunken Vault") through the actual `/dm?new=1` UI, confirmed it renders fully isolated
   state (its own invite code, empty party, empty log) while the original "Demo campaign" kept
   its own data untouched across switches; confirmed `/play`'s switcher lists both campaigns for
   the same account; and confirmed the target picker itself by selecting Kira Stormwind (not the
   default first character) and dealing 6 damage — her HP dropped 24→18 while Demo character's
   stayed untouched at 20/20, proving damage/heal/condition events route to the *selected*
   character, not always the first one.
8. ~~Rules engine: validate event targets.~~ Done, out of order (picked over the picker on
   request) — the first check beyond zod shape validation. Verified three ways: an automated CI
   test with a wrong-campaign target and a nonexistent target, both asserted to fail; the same
   test run live against the real project; and a real damage/heal round-trip through the actual
   `/dm` UI afterward, confirming the trigger doesn't reject legitimate events.
9. ~~Server-side dice + the `attack` event type.~~ Done — the first of the four constraints in
   "The one rule that matters" with zero prior implementation. Verified live through the actual
   `/dm` UI: a normal attack (roll 2, AC 10 → Miss), then an advantage attack (+15 modifier,
   `rawRolls: [19, 5]`, kept 19 → Hit) — confirmed by reading the committed payload back from the
   real project, seed and all. Found and fixed a real bug in the process: the first version set
   `actor` to the attacking character's id and every insert failed `events_actor_fkey` (`actor`
   references `public.users`, not `characters`) — caught by actually submitting the form live,
   not by build or lint. Also verified live (not just in CI) that the widened target-validation
   trigger rejects an attack naming a nonexistent character.
10. ~~Round tracker.~~ Done — the `round` event type, folded the same way HP/conditions are
    rather than stored. Verified live with three tabs open at once (`/dm`, `/table`, `/play`, all
    on the same real campaign): clicking through a full start 1 → end 1 → start 2 cycle in the DM
    console propagated to both read-only surfaces over Realtime with no refresh, matching the
    exact number and phase at every step.

One live-project setting was changed to unblock local testing: **Confirm email is currently off**
on the `ember` Supabase project (Auth → Sign In / Providers). Turn it back on before real users
sign up.

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

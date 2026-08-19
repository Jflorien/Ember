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

`next build` and `next dev` share `.next` by default — running a verification build while a dev
server is live corrupts its cached chunks (missing-module / "Unexpected end of JSON input" errors
in the browser until the dev server restarts). `next.config.ts` reads `NEXT_BUILD_DIR` to redirect
a verification build elsewhere: `NEXT_BUILD_DIR=.next-verify npm run build` leaves a running dev
server untouched. CI and real builds don't set it, so they're unaffected.

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
| `/dm`    | desktop | DM console. Can write any event by hand — the only surface with no ownership restriction. |
| `/play`  | phone   | Character sheet, inventory, slots, dice. Can propose events *scoped to the player's own character* (attack with it, self-report damage/heal/conditions to it); reads everything else it may see. |
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

`supabase/migrations/0001_init.sql` onward. Tables: `users`, `campaigns`, `memberships`,
`characters`, `sessions`, `events`.

RLS is the security boundary, not the UI:

- A campaign is readable only by its owner or a member.
- `events.visibility = 'dm_only'` → readable only by that campaign's DM.
- `events.visibility = 'player:<uuid>'` → readable by the DM and that one player.
- `events` has no UPDATE/DELETE policy — append-only is enforced by the database.
- `events` INSERT: the DM can always write (`events_insert_dm_only`). A non-DM campaign member can
  additionally write an `attack` event where they own the attacker, or a `damage`/`heal`/
  `condition` event where they own the target — nothing else, and never another character's
  (`events_insert_player_self_action`, `0006_player_self_action_events.sql`). Multiple permissive
  policies on the same operation combine with OR, so this widens who can write without touching
  the DM's original policy.
- Characters: readable by all campaign members, writable by owner or DM.

RLS helpers (`is_campaign_member`, `is_campaign_dm`, `session_campaign_id`, `owns_character`) are
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

`/play` is no longer read-only — the first crack in "the DM console is the only surface that
writes," on request, because the point of every device subscribing to the same stream is that
every device can act on it, not just watch it. `0006_player_self_action_events.sql` adds a second,
additive INSERT policy (`events_insert_player_self_action`) alongside the DM's: a non-DM campaign
member may now insert an `attack` event where they own the attacker (target can be anyone — that's
the point of attacking), or a `damage`/`heal`/`condition` event where they own the *target*
("this happened to me," not "I did this to someone else"). Two new helpers back it —
`owns_character` (mirrors `is_campaign_dm`'s security-definer shape) and `payload_uuid` (reads a
uuid out of a payload without raising on a bad or missing key, since a hard error inside an RLS
check would surface as a confusing insert failure). `PlayerActionPanel`
(`src/components/player-action-panel.tsx`, `/play` only) reuses the exact same `AttackComposer`/
`DamageHealComposer`/`ConditionComposer` the DM console uses — attackerId and the self-report
targetId are just fixed to the player's own character instead of coming from a picker; no new
propose\*Event logic was needed, since RLS was already the enforcement boundary, not the app layer.
Verified three ways: an automated CI test (`supabase/tests/player_self_action_test.sql`) asserting
both the accept and reject paths; the same test run live against the real project with the
simulated-second-user technique, rolled back; and a real attack plus a real self-reported damage
event submitted through the actual `/play` UI, both confirmed by reading the committed rows back
and watching `/table` render them live over Realtime.

The DM console gained member management: `MemberManagement` (`src/components/member-management.tsx`)
lists everyone who's joined via invite code, with a player/spectator role select and a Remove
(kick) button per row, and `InviteCodeDisplay` gained a "Regenerate" button. No new migration —
`memberships`/`campaigns` RLS from `0001_init.sql` already restricted insert/update/delete to the
owner or DM, this just gives that existing permission a UI. Deliberately narrow: the role select
only offers `player`/`spectator`, not `dm` — promoting someone to co-DM is a bigger trust
delegation than this panel is scoped for, even though the RLS itself would technically allow it.
Kicking only deletes the membership row; a kicked player's characters stay as they were. Caught a
real bug live: the role `<select>` used `defaultValue`, an uncontrolled-input pattern React only
reads on mount — after `revalidatePath` refetched the new role, the dropdown kept showing the
*pre-save* value even though the write had already succeeded, because React doesn't touch an
uncontrolled element's value on re-render. Fixed with `key={member.role}`, forcing a remount
whenever the underlying role actually changes. Verified live: role toggled player → spectator →
player (each confirmed by querying the row directly, not just trusting the UI, which is exactly
what caught the bug), invite code regenerated and reflected without a refresh, and a kick that
removed the membership row while leaving the account's own DM access untouched (ownership, not
membership, is what `is_campaign_dm` checks first).

A real UI pass landed against the Notion specs (`DM Console Panels` and `In-Session Player
Dashboard Panels`, both first-drafted earlier in this project) — every piece that could be backed
by real, already-committed data, nothing fabricated. Deliberately skipped: the map/grid panels
(Live Table/Map Control, Encounter Staging), NPC/monster stat blocks, the AI co-pilot, and
ability scores/spells/actions — all still blocked on systems that don't exist, and faking them
would be UI theater the app doesn't actually do anything with.

What shipped: **event visibility control** (DM Console Panels §7, "Hidden Information &
Visibility") — every DM composer (`narration`/`attack`/`damage`/`heal`/`condition`/`loot`) gained
a `VisibilitySelect` (`src/components/visibility-select.tsx`) offering `public` / `dm_only` /
`player:<uuid>` per member, wired through `readVisibility()` replacing what had been a hardcoded
`"public"` on every propose\*Event since the very first one. `player:<uuid>` is scoped by the
character's *owning user*, not the character itself, so `getPartyMembers`/`PartyMember` gained
`ownerId`. `LiveEventFeed` now shows a visibility badge and, for `dm_only` rows, a **Reveal**
button (`revealEvent`) that emits a *new* public narration describing the hidden event rather
than mutating it — same append-only shape as everything else in this log. The composer components
(`AttackComposer`/`DamageHealComposer`/`ConditionComposer`) take `members` as an *optional* prop
now: present (DM context) renders the selector, absent (`PlayerActionPanel` on `/play`) omits it
and the server action defaults to `public` — one shared component, two call sites, no
visibility-control leak into the player's self-action panel.

**Loot** (§9) is built end to end — `proposeLootEvent` + `LootComposer`
(`src/components/loot-composer.tsx`), freeform item name + quantity per submission (the payload's
`items` array needs no catalog, `itemId` stays `null`). The event-target-validation trigger
widened again (`supabase/migrations/0007_validate_loot_targets.sql`) to cover `loot`'s `targetId`,
same pattern as 0005 for `attack`. `describeEvent` gained a loot case ("Loot: 3× Healing Potion").

**Character class/level** — `characters.class`/`.level` existed in the schema since
`0001_init.sql` with zero UI. `CreateCharacterForm` gained both fields (class is freeform text —
Ember's own classes like Wildfire Barbarian aren't a fixed SRD catalog either, so a dropdown would
already be wrong), and `/play`'s Session Header shows them once set ("Your character — Wildfire
Barbarian, Lv 3"), falling back to the old plain label for characters created before this shipped.

**Panel reorg** — `/dm` restructured into named `PanelSection`s matching the spec's information
architecture (Session Setup, Turn Control, Party, Event Console, Session Log) instead of one flat
stack of components; every piece inside each section is the same real, already-wired
functionality, just organized under the name the spec gives it.

Verified live: a `dm_only` narration committed, confirmed invisible in the initial render and
correctly badged once it appeared, `Reveal` emitting the expected public follow-up (checked by
reading both rows back); a loot event committed and rendered correctly on `/table`
("Loot: 3× Healing Potion"); a new character created through the real `/play` form with class and
level, confirmed both in the DB and in the Session Header's rendered chip. Note: verifying that a
*non-DM* player can't see a `dm_only` event has to lean on the earlier `rls_leak_test.sql` (the
account driving this session is the DM everywhere it's logged in, including `/table`, so a
same-account check would show `dm_only` content there too — that's identity-based RLS working
correctly, not a leak) — this pass didn't touch the SELECT policy at all, only added.

The map/grid primitive is built — `terrain` and `move`, the two event types DM Console Panels §4
("Live Table / Map Control... the surface that actually authors `move`/`terrain`/`destroy`
events") names first. No new tables: map state is a fold, same as everything else — `terrain`
cells fold from committed `terrain` events (`useSessionTerrain`, last-per-cell wins, no "clear"
yet), character positions fold from `move` events (`useCharacterPositions`, last-per-actor wins).
`MapGrid` (`src/components/map-grid.tsx`) is the shared rendering primitive — fixed 16×10 grid
(`src/lib/grid.ts`), terrain glyph *and* color per cell (never color-alone), character-initial
tokens. Read-only on `/table` via `TableMap`, matching the player-dashboard spec's "this screen
never renders the map... terrain and tokens only" — `/table` widened to `max-w-5xl` and the event
feed shrank to make room, since the map is the point now. Interactive on `/dm` via
`MapControlPanel`: a Move/Terrain mode toggle over the same grid, one click either moves the
selected character or places the selected terrain type. `proposeMoveEvent` reads `from` from the
last committed `move` event server-side (never trusted from the client, same shape as attack's
dice and round's counter) and computes `feetSpent` as chessboard distance × 5ft; `feetRemaining`
isn't enforced yet — there's no per-turn movement budget modeled. The target-validation trigger
widened again (`supabase/migrations/0008_map_grid_events.sql`) to check `move`'s `actorId` instead
of `targetId` (same function, a `v_field` variable picks the column name per type now), and the
player-self-action RLS policy widened in the same migration so a player can move their own
character — matching the attack/damage precedent — though `/play` has no move *UI* yet: the
spec's "never renders the map" rule means there's no grid to click there, and a coordinates-only
input with nothing to reference would be bad UX. The RLS permission and its CI test exist anyway,
ahead of whatever that control ends up looking like (compass buttons, most likely, not raw x/y).
Verified live: a wall placed and rendered on `/table`; a character moved from its default `{0,0}`
origin to a new cell, `from` correctly read server-side, both terrain and the token confirmed by
inspecting `/table`'s actual rendered cells (glyph, title, token letter), not just the DB. Caught
a real *test-script* bug in the process (not an app bug) — clicking a mode-toggle button and a
grid cell in the same synchronous script fires the second click before React re-renders with the
new mode, so it lands under the stale closure; splitting into separate tool calls fixed it, and
is worth remembering for any future scripted UI test that changes local state then immediately
depends on it.

The spell content model exists now: `spells` (`supabase/migrations/0009_spells.sql`), global
reference data readable by every authenticated user — a spell means the same thing in every
campaign, so it isn't scoped to one, unlike characters or events. Seeded with 16 spells: 15 real
SRD 5.2.1 spells spanning cantrip through 3rd level across damage, healing, buff, and utility
(Fire Bolt, Magic Missile, Cure Wounds, Shield, Fireball, and eleven more), plus one original spell
— `source: 'original'` marks the difference, satisfying CLAUDE.md's "must support original classes
and subclasses, not just a seeded SRD dump." That original spell, Shock Spark, was already named
in the Notion "SORCERER SPELL LIST" as `(original)` with no mechanics ever written down; it's
filled in here as a conservative Fire Bolt reskin (lightning instead of fire) rather than inventing
new mechanics unprompted — worth a real design pass whenever the actual creative intent for it
exists. `cast` is wired end to end on it: `proposeCastEvent` denormalizes `spellName` into the
payload at cast time (same reasoning as attack's seed/rawRolls — the event should describe what
actually happened even if the spells row changes or is deleted later), and `CastComposer` reuses
`TargetedComposers`' existing Attacker picker as the caster. No per-character "known spells" list
or spell-slot tracking exists, so the picker is the full compendium and nothing stops picking a
spell above the caster's level — matching the same "shape, not full legality" line every other
event type draws today. Verified live: cast Fireball at slot 3 through the actual `/dm` UI,
confirmed the full payload (spell name, slot, caster, target) landed correctly, and watched it
render on `/table` as "Cast: Fireball (slot 3) — 1 target."

`cast` reached parity with `attack`/`move`/`loot` in a follow-up pass: the target-validation
trigger widened once more (`supabase/migrations/0010_validate_cast_targets.sql`) with a dedicated
branch for `cast`, since its shape doesn't fit the single-`targetId` pattern every other type
uses — `casterId` is one uuid, `targetIds` is an array, so both get checked (caster against the
session's campaign, then every array entry). The same migration widens
`events_insert_player_self_action` so a player can cast where they own the caster, and
`PlayerActionPanel` gained the `CastComposer` — a player can now roll their own spell against
any target, same shape as their own attacks. Verified live: the trigger rejected a cast naming a
nonexistent target character on the real project, and a real Magic Missile cast through the
actual `/play` UI landed with `casterId` correctly set to the player's own character.

`destroy` and `reveal` are wired end to end too, both reusing existing primitives rather than
adding anything new. `destroyPayloadSchema` changed shape from `targetId` (a character reference
that never made sense for a destructible prop) to `cell` — the same `{x, y}` shape `terrain`
already uses. `proposeDestroyEvent` checks server-side that the cell's *current* terrain (the
last committed `terrain` event for it) is actually marked `destructible` before committing,
never trusted from the client. `useSessionTerrain` folds `destroy` by clearing the cell — which
also closes the earlier "terrain clearing" gap, since destroying *is* how a cell gets cleared;
there's still no separate "just clear this, nothing was destroyed" action. `MapControlPanel`
gained a third Destroy mode alongside Move/Terrain. Separately, `revealEvent` — previously a
shortcut that emitted a synthetic `narration` event — now emits a real `type: "reveal"` event
using the schema that was already defined for it, with a denormalized `description` field (same
reasoning as attack's seed/rawRolls) so `/table` can render it without joining back to an event
that's still `dm_only` to everyone but the DM. Verified live: placed a destructible prop, watched
it disappear from `/table`'s actual rendered grid after destroying it (not just the DB), and
confirmed Reveal now commits a `reveal` row with the right shape and still renders correctly.

The **AI narration co-pilot** is the first piece of "anything AI" in this repo — a single-shot
suggestion tool, not an autonomous DM. `src/lib/ai/env.ts` reads `ANTHROPIC_API_KEY` lazily (same
"never at module top-level" rule as Supabase's env helper, so the build still succeeds with no
key set), `src/lib/ai/system-prompt.ts` holds `NARRATION_COPILOT_SYSTEM_PROMPT` (adapted from the
Notion "System Prompt Template Example" but deliberately scoped down to match what's built — no
dice, no mechanics, no autonomous state changes, SRD-only content), and `suggestNarration`
(`src/app/dm/ai-actions.ts`, a new file rather than growing the 1000+-line `actions.ts` further)
sends the campaign's last 20 committed events (rendered through the existing `describeEvent`) plus
the DM's short prompt to Claude and returns suggested narration text — it never commits anything
itself. `EventComposer` gained a second small form beneath the narration composer: typing a
prompt and clicking Suggest fills the narration text field with the response; editing that text
afterward, or writing narration from scratch, keeps `proposed_by: "human"`, while sending an
unedited suggestion verbatim sets `proposed_by: "model"` — the first real use of the
`proposedBySchema` field every prior event has hardcoded to `"human"`. Verified live: with no
`ANTHROPIC_API_KEY` set, clicking Suggest surfaces the exact lazy-env error message
(`Missing ANTHROPIC_API_KEY...`) through the real `/dm` UI, confirming the error path end to end;
the actual Claude round-trip is not yet verified live — no key was available this session, so
ship-without-live-verification was the explicit call here, unlike every other feature in this log.

The **Player Dashboard** got its first real pass beyond the "early proof" HP bar — character
creation now covers ability scores, AC, speed and saving throw proficiencies, and `/play` gained
the Core Character Stats Panel plus real portrait uploads. `src/lib/characters/sheet.ts` holds
the versioned (`v: 1`, same reasoning as `GameEvent` payloads) `characterSheetSchema` — ability
scores, AC, speed, saving-throw proficiencies — plus the derived-stat helpers (`abilityModifier`,
`proficiencyBonusForLevel`, `passivePerception`, `initiativeModifier`, `savingThrowModifier`) and
`readCharacterSheet`, which every reader now goes through so a pre-existing character's bare
`{maxHp}` sheet degrades to an untrained baseline (all 10s, AC 10, 30ft speed) instead of crashing.
`CreateCharacterForm` assigns the SRD standard array (15/14/13/12/10/8) across the six abilities
via six selects that swap on collision, so the "each value used once" invariant holds
client-side and is still re-checked server-side in `createCharacter`; point buy and rolling aren't
built. `CoreCharacterStats` (`/play` only, In-Session Player Dashboard Panels §2) renders AC,
Initiative, Speed, all six ability scores with modifiers, saving throws with proficiency
highlighting, and Passive Perception — the last one always untrained (10 + WIS mod) since no
skill-proficiency system exists yet. Avatars are real: `characters.portrait_url` existed since
`0001_init.sql` with nothing to populate it — `0011_character_portraits_storage.sql` adds a public
`character-portraits` Storage bucket, RLS-gated on writes by the same `owns_character` helper
`0006` already uses (path's first segment is the character id), and `updateCharacterPortrait`
(`src/app/dm/actions.ts`) uploads server-side through the same Supabase client every other write
in this app uses — never the browser client directly. `PortraitThumb` (initials-fallback avatar
tile, reusing `.plate` rather than a hand-rolled clip-path) now shows on the character sheet, the
upload control, and every Party Status Strip tile on both `/dm` and `/play`. Verified live: a
real character created through the actual `/play` UI with a full ability-score assignment (STR/CON
swapped via the picker) and two saving-throw proficiencies, confirming AC 12, Initiative +2, and
saving throw modifiers (+3 STR, +4 CON, proficiency bonus correctly applied; all other saves at
raw modifier) rendered correctly by `CoreCharacterStats`; a pre-existing character (bare `{maxHp}`
sheet, created before this shipped) confirmed still rendering via the legacy-fallback path (AC 10,
all scores 10, all saves +0). The avatar upload's storage RLS was verified with the same
simulated-second-user SQL technique as every other RLS test in this project (owner insert/update
accepted, non-owner insert/update rejected, anon select allowed) — the live browser file-upload
click-through itself wasn't completed this session, since the real Chrome profile used for the
Supabase dashboard has no session cookie for the app itself; a permanent CI test
(`supabase/tests/character_portraits_test.sql`) covers the same RLS logic going forward. Also
fixed in passing: `.next-verify` (the `NEXT_BUILD_DIR`-redirected verification build output) was
never excluded from ESLint, so a leftover verification build silently broke `npm run lint` with
thousands of unrelated errors from its generated `.d.ts`/`.ts` files — added to `eslint.config.mjs`
alongside `.next`.

**`/play` is a real dashboard now**, not one page. `src/app/play/layout.tsx` holds the shared
header and `PlayerNav`, and the app splits into four routes: `/play` (Player Home — campaigns,
roster summary, quick actions), `/play/session` (the in-session dashboard that used to *be*
`/play`), `/play/characters` (Character Roster), `/play/characters/new` (creation, previously
rendered inline on the session screen whenever a player happened to have no character), and
`/play/account`. Middleware needed no change — it already matches `/play` by prefix. The nav's
active tab is molten, deliberately *not* forge/gold: the design system reserves gold for "it is
your turn," which a nav tab never is.

That split needed the **`death` event type**, the last one in the `GameEvent` union with no
implementation — the roster splits Living from Fallen, and "fallen" has to mean something.
`deathPayloadSchema` already existed; it gained a denormalized `characterName` (same reasoning as
cast's `spellName`) so the log still reads correctly if the character row is later deleted.
`0012_death_and_account_deletion.sql` adds `death` to the target-validation trigger — it carries
the same single-`targetId` shape as damage/heal/condition/loot, so no new branch was needed,
unlike `cast` in 0010. It is deliberately **not** added to `events_insert_player_self_action`: a
player can self-report damage, healing and conditions, but declaring a character dead is the DM's
call, so `death` stays DM-only. `DeathComposer` (`/dm`, behind a confirm step) is the only writer.
Death is currently terminal — there's no revival event, so the roster fold reads "any `death`
event naming this character" as dead rather than last-event-wins; worth revisiting if a real
raise-dead mechanic ever exists.

**Account settings** (`/play/account`) covers auth plus the two GDPR rights that need real
implementations rather than a policy page: portability (art. 20) and erasure (art. 17).
`updateEmail`/`updatePassword` live in `src/app/auth/actions.ts` — the password change
re-authenticates with the current password first, because Supabase's `updateUser` doesn't require
it and an open session alone shouldn't be enough to change a password. `exportMyData` returns
every row this account owns or can read as JSON, assembled through the normal authenticated
client so RLS decides what's included, and the client turns it into a download. `deleteMyAccount`
calls `delete_my_account()` (0012) — a `security definer` function taking **no arguments by
design**, so the only account it can ever delete is `auth.uid()`'s; the project has no
service-role key configured (it runs on the anon key alone), which is why this is an RPC rather
than `auth.admin.deleteUser`. Deleting the `auth.users` row cascades to campaigns the account
owns and everything inside them, so the UI names those campaigns in the warning and requires
typing the account's own email to confirm.

Verified live throughout: all four tabs rendered against the real project; a `death` committed
through the real `/dm` UI and confirmed moving Grix Stonefist from Living to Fallen on
`/play/characters` with the right cause, which also proved the roster's
`.in("payload->>targetId", ids)` PostgREST filter actually works (a JSON-path `in` filter is
exactly the kind of thing that silently matches nothing); `describeEvent` rendering it in the
session log; the data export producing a real blob download with no errors; and
`delete_my_account()` run against the live project inside a rolled-back transaction, confirming
it deleted the caller and their character (0/0) while leaving another user and that user's
campaign untouched (1/1). A CI test (`supabase/tests/death_and_account_deletion_test.sql`) locks
all of that in, including an assertion that a player *can't* declare death — so a future widening
of the self-action policy has to break that test on purpose rather than by accident.

Two fixes in passing: joining a campaign left the player sitting on the join form with no sign
anything had happened — `joinCampaignAction` already had the campaign id back from the RPC and
was throwing it away, so it now redirects into the session. And a **verification-technique**
lesson worth keeping: driving the Supabase SQL Editor with ctrl+Return silently does nothing when
focus isn't in the editor, and scraping the result panel with `document.body.innerText` returns
the *previous* query's output — together those reported "0 rows" for a `select count(*)`, which
is impossible and is what exposed it. Three `death` events had committed correctly the whole
time. Click the Run button and read the result from a screenshot, never from scraped innerText.

A **presentation pass on the three surfaces**, on request ("focus on building the product
frontend... having something to present") — no new backend, purely how the built systems read.

`/dm` was the worst of the three: a ~520px column on a 1280px desktop, headed "Propose an event.
Watch it commit." over a paragraph about zod and Realtime, with all eight composers rendered at
once so the DM scrolled past seven forms to reach the one they wanted. It reads as a test
harness because that's what it grew from. It's now a real three-rail console — party/turn/invite
left, map and event console centre, session log right — viewport-locked at `xl` so each rail
scrolls independently, and stacking back to one column below that. `ConsolePanel` gives each
region an actual header and edge; `EventConsole` replaces the stack with tabs (Narration, Attack,
Damage/Heal, Condition, Cast, Loot, Death), with the attacker/target pickers lifted above the
tabs since they're shared context that shouldn't reset when the DM switches action.

`/table` was a centred `max-w-5xl` column, which on a 16:9 TV left most of the screen empty and
pushed the log below the fold. Map and log sit side by side now, the campaign name and round are
a real header, and the party rail is on screen — "heat is state" only means anything if HP is
actually readable from the sofa. `MapGrid` gained a `size` prop so glyphs and tokens step up on
the TV, and its gridlines moved from basalt-800 to basalt-700: against basalt-900 cells the old
pairing was so close in luminance that the map read as a flat dark slab.

The biggest content fix was `describeEvent`, which only had cases for 6 of 13 event types —
everything else rendered as a bare `[damage]`, `[terrain]`, `[move]`. Every type has a case now,
and it takes an optional `NameLookup` so lines read "Kira Stormwind takes 6 fire damage" instead
of a uuid. The lookup is a parameter rather than a name denormalised into each payload precisely
because the parameter fixes *already-committed* events too. `LiveEventFeed` also flipped to
newest-first, which is what a rail is read for.

Two Tailwind/CSS gotchas worth keeping alongside the `shadow-[var(--glow-md)]` one: `h-[calc(100vh-3.5rem)]`
is silently dropped because `calc()` needs spaces around the `-` (Tailwind arbitrary values want
`calc(100vh_-_3.5rem)`, underscores becoming spaces) — and even once valid it was the wrong fix,
since `flex-1` on a child of a growing parent wins over an explicit height; the parent needed
`h-screen`. Also: a `{/* */}` comment placed before the single root element of a `return (...)`
is a syntax error, not a comment.

Verification note: the Browser pane's screenshots letterbox a wide viewport into a fixed-scale
image, so a correct full-width layout can look like it occupies the top-left third of the screen.
That misread sent me chasing two non-existent layout bugs; `getBoundingClientRect` measurements
settled it both times. Measure the DOM, don't eyeball a scaled screenshot.

A **seeded demo encounter** closes the last gap between "the systems work" and "there is
something to show": `seedDemoCampaign` (`src/app/dm/demo-actions.ts`, a new file rather than
growing `actions.ts`) builds a whole campaign in one click — *The Ashfall Crypt*, a party of
three, a mapped crypt chamber (outer wall with a doorway, two brazier hazards, collapsed rubble,
destructible grave goods), and an event log with a real fight already in progress.

It always creates a **new** campaign rather than filling in an existing one, so seeding is
repeatable and can never touch real table data. Everything goes through the same tables,
triggers and RLS as hand-authored play — there is no "demo mode" branch anywhere in the app, and
a seeded campaign is indistinguishable from one built by hand. That's deliberate: if the demo
renders, the real thing renders. The attack rolls are real `rollDice` draws with the seed and raw
rolls committed, so even the demo's numbers are auditable, and the `cast` event points at the
actual Thunderwave row in the `spells` table rather than a plausible-looking uuid.

Two things fell out of building it. First, **the monster is a character row owned by the DM** —
`attack`'s validation trigger requires a real character in the same campaign, and there is no NPC
or stat-block model, so until there is one an NPC *is* a character. The visible cost is that the
Cinder Wight appears in the Party strip with its HP on `/table`, which players shouldn't see;
that's the clearest argument yet for an NPC model being the next backend piece. Second,
**`terrain` events are now filtered out of both event feeds**. Drawing a room is ~44 events, and
leaving them in buried the narrative under "wall placed at 3, 2" — terrain is map authoring, not
story, and the map itself is where it's verified. `destroy` stays in, because something being
wrecked is a beat the table cares about.

Verified live end to end: seeded from the real `/dm` empty state, then confirmed all three
surfaces render the same seeded session — the console's map, party and log; `/table` showing the
chamber, four wrapped party tiles and the heat-recency feed; and `/play` showing Rowan Ashbound
at 21/32 with a `frightened 2r` pill. The HP folds check out against the seeded damage
(45−13−9=23, 32−11=21, 34−5=29), which is the real test that the demo is data and not a picture.
The party strip also stopped scrolling horizontally and wraps instead — nobody scrolls a TV.

**Not built:** the rest of the rules engine (attack is one invariant plus one full event type,
not full legality — nothing yet checks whether a character has the spell slot it's spending, and
a hit or a damage-dealing spell still requires a manual follow-up damage event rather than applying
one automatically), revival (`death` is terminal — no raise-dead event, and no "downed but
stabilising" state between the `unconscious` condition pill and death), a post-creation character
editor (the roster spec's Edit/Archive actions, and its "Archived" status, which needs a state
that isn't death), `reveal`'s *map-area* half (`area` on the payload is wired but
nothing uses it yet — that's fog of war, which needs cells to have a default-hidden state per
player first), known-spells/spell-slot tracking on the character sheet (right now any caster can
pick any spell at any slot level), spell slots and inventory more broadly, map upload/resize
(fixed 16×10 for now), the NPC/monster/encounter-staging panels from the DM console spec, skills
and proficiencies (so Passive Perception and any future skill checks stay untrained-only), point
buy/rolled ability scores, the rest of the Character Creation/Level Up wizard (background,
alignment, spells-known-at-creation, starting equipment/gold, the level-up flow itself), and the
rest of the Actions & Spells panel (spell *browsing* on `/play` — the compendium exists now, but
nothing surfaces it there yet). The AI co-pilot itself only suggests narration text — it doesn't
call for rolls, adjudicate, or propose mechanical events, and there's no autonomous "AI as DM"
mode.

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
11. ~~Player self-action.~~ Done, on request — "the entire point is also to have the devices
    hearing what's being told and acting accordingly." `/play` gained a real write path: a player
    can now attack with their own character or self-report damage/heal/conditions to it, enforced
    at the RLS layer (`0006_player_self_action_events.sql`) so the boundary holds no matter what
    UI calls it. Verified with the same simulated-second-user technique as the RLS leak test
    (own-character insert accepted, other-character insert rejected, both live against the real
    project and rolled back), plus a real attack and a real self-reported damage event submitted
    through the actual `/play` UI and watched propagate to `/table` live.
12. ~~Member management.~~ Done — role changes and kicks on the DM console, using the
    insert/update/delete permissions `0001_init.sql`'s memberships RLS already granted the DM
    but nothing had a UI for yet. Verified live end to end (role player → spectator → player,
    invite code regeneration, a kick) — and caught a real bug doing it: an uncontrolled
    `<select defaultValue>` doesn't re-read its value on re-render, so the role dropdown kept
    showing the pre-save role after a successful write until fixed with `key={member.role}` to
    force a remount. Confirmed by querying the database directly rather than trusting the UI,
    which is exactly what surfaced the bug in the first place.
13. ~~UI pass against the Notion panel specs.~~ Done, scoped to what's real: event visibility
    control + Reveal (DM Console Panels §7), a `loot` composer (§9), character class/level, and
    `/dm` reorganized into the spec's named panels. Everything else in both specs — maps, NPCs,
    AI co-pilot, ability scores, spells — stayed unbuilt on purpose rather than faked. Verified
    live: a `dm_only` narration committed and revealed correctly (both rows confirmed in the DB),
    a loot event rendered on `/table`, and a new character created through the real `/play` form
    showing its class/level in the Session Header.
14. ~~Map/grid primitive.~~ Done — `terrain` and `move`, folded live like every other piece of
    state in this app, no new tables. `MapGrid` renders terrain + character tokens on a fixed
    16×10 grid; read-only on `/table` (the spec's "terrain and tokens only"), interactive on `/dm`
    via a Move/Terrain mode toggle. Verified live: a wall placed and a character moved from its
    default origin, both confirmed by inspecting `/table`'s actual rendered grid cells, not just
    the database. Not a bug, but worth remembering: a scripted UI test that toggles local state
    and immediately clicks a cell in the *same* synchronous call fires under the stale pre-toggle
    closure, since React hasn't re-rendered yet — splitting into separate calls fixed it.
15. ~~SRD/spell content model.~~ Done — a real `spells` table (16 rows: 15 SRD 5.2.1 spells plus
    one original, `source` marking which), and `cast` wired end to end against it. No known-spells
    or spell-slot tracking yet, so any caster can pick any spell freely — the same "shape, not full
    legality" line every other event type draws. Verified live: cast Fireball at slot 3 through the
    actual `/dm` UI, confirmed the full payload landed correctly, and watched it render on `/table`.
16. ~~Cast target validation + player self-cast.~~ Done — brought `cast` to parity with
    `attack`/`move`/`loot`. The target-validation trigger widened again for `cast`'s
    array-shaped `targetIds` (`0010_validate_cast_targets.sql`), and a player can now cast with
    their own character via the same self-action RLS policy attack/move already use. Verified
    live: the trigger rejected a cast naming a nonexistent character on the real project, and a
    real Magic Missile cast through the actual `/play` UI landed with the correct caster.
17. ~~destroy + reveal.~~ Done — both reuse existing primitives rather than adding anything new.
    `destroy` now addresses a grid `cell` instead of a character `targetId`, checked server-side
    against the cell's current `destructible` flag; folding it also closes the earlier "terrain
    clearing" gap. `reveal` replaced its narration-emitting shortcut with the real `reveal` event
    type the schema already defined. Verified live: a destructible prop placed and then destroyed,
    confirmed gone from `/table`'s actual rendered grid; Reveal confirmed committing a real
    `reveal` row and still rendering correctly.
18. ~~AI narration co-pilot.~~ Done — the first real AI integration, deliberately scoped to a
    single-shot narration suggestion the DM reviews before sending, not an autonomous DM.
    `suggestNarration` (`src/app/dm/ai-actions.ts`) calls the Anthropic API with the campaign's
    recent event log and never commits anything itself; `EventComposer` wires a Suggest button
    that fills the narration field, tracking whether the DM sent it unedited (`proposed_by:
    "model"`) or wrote/edited their own (`"human"`) — the first real use of that field. Verified
    live that the missing-key error path surfaces correctly through the actual `/dm` UI; the real
    Claude round-trip is unverified pending an `ANTHROPIC_API_KEY` in `.env.local` — shipped
    without live verification on request, the one exception to this project's usual rule.
19. ~~Player Dashboard: character creation stats + avatars.~~ Done, on request ("character
    creation, avatar, stats, models, everything") — scoped to the two Notion panels that had zero
    data model yet: Abilities & Stats (creation) and Core Character Stats (in-session). Ability
    scores/AC/speed/saving-throw proficiencies now live in a versioned `characters.sheet` shape
    (`src/lib/characters/sheet.ts`), and `characters.portrait_url` — unused since `0001_init.sql`
    — now has a real Storage bucket behind it (`0011_character_portraits_storage.sql`), RLS-gated
    by the same `owns_character` helper player-self-action events use. Skills/proficiencies,
    equipment/gold, and spells-known-at-creation — the rest of the Character Creation/Level Up
    wizard spec — stayed unbuilt on purpose, matching how every other feature in this log scopes
    to one real vertical slice rather than a half-built pass across five specs at once. Verified
    live: a character created through the real `/play` UI with the standard-array picker (STR/CON
    swapped) and two save proficiencies, confirming every derived stat (AC, initiative, saving
    throw modifiers with correct proficiency-bonus application) rendered correctly, plus a
    pre-existing character confirmed still rendering via the new legacy-sheet fallback. The
    portrait Storage RLS was verified with the simulated-second-user SQL technique (owner
    accepted, non-owner rejected) and gained a permanent CI test; the actual browser file-upload
    click-through is the one piece not verified live this session (the Chrome profile used for
    the Supabase dashboard has no app session cookie) — shipped without that one verification, on
    the same "document the gap honestly" precedent as the AI co-pilot's unverified Claude
    round-trip.
20. ~~Player dashboard split + death + account settings.~~ Done, on request ("the player app
    needs a clear division of things... its own dashboard"). `/play` became four routes behind a
    shared layout and tab nav; `death` shipped end to end because the roster's Living/Fallen
    split needs it (DM-only, deliberately excluded from the player self-action policy); and
    `/play/account` covers email/password changes plus real GDPR export and erasure, the latter
    via a no-argument `security definer` RPC that can only ever delete its own caller. Verified
    live across all four tabs, with the death fold confirmed through the real UI and the deletion
    RPC proven against the live project inside a rolled-back transaction. Also caught a
    verification-technique bug that had been reporting false negatives — see the "State of play"
    note about the SQL Editor's Run button.

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

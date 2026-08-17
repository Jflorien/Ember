# Notion reconciliation — "Side Project" wiki

Read of ~80 pages, August 2026. This records where the design doc disagrees with itself, where
it stops, and where it disagrees with the architecture in `CLAUDE.md`. Each item needs a decision
before the affected system gets built.

---

## 1. Contradictions to settle

### Who rolls dice — **blocking, decide first**

- `10. AI Dungeon Master System` §10.3: the AI **"may not: Roll dice."**
- `AI Dungeon Master` §2.4 step 3: the AI may *"internally roll (or accept rolls from your dice API)"*.

These cannot both hold. The architecture resolves it in favour of **server-authoritative,
seeded, audited rolls** — the model narrates given results and never produces randomness.
A table that suspects the dice cannot stop suspecting them, and an LLM "internal roll" is
neither reproducible nor auditable.

**Action:** delete the internal-roll language from the AI DM page.

### NPC attitude scale

- `7. Social Interaction` §7.1 — four states: Friendly → Neutral → Suspicious → Hostile
- `ADVENTURING RULES` — three states: friendly, indifferent, hostile

**Action:** pick one before it becomes an enum column. The four-state version carries more
signal for an AI DM tracking relationships.

### Movement economy

- `3. Combat System` §3.3 treats the turn as `1 Action, 1 Bonus Action, 1 Move, 1 Reaction` —
  movement as a single atomic resource.
- `Combat Rules` says *"You may break up movement before and after actions"* — movement as a
  depletable pool.

**Action:** the schema needs a speed pool with remaining feet, not a boolean. The second page
is correct and matches SRD.

### Encumbrance is optional or it isn't

`6. Exploration Rules` and `Rules Framework` both mark it optional; `ADVENTURING RULES` states
`STR × 15` flatly. **Action:** make it a campaign-level settings flag.

---

## 2. Specs that stop mid-thought

- **`4. Hit Points & Healing` is an empty outline.** Every subsection is a note-to-self
  ("What HP represents; max, current, temp.", "Death saves system."). The actual numeric rules
  ended up in `Combat Rules` and `ADVENTURING RULES` instead. Either fill it in or delete it so
  it stops looking authoritative.
- **`Progression Systems`** retains a literal authoring placeholder: *"(separate list of what is
  unlocked by race/class)"* with no list attached.
- **XP has no numbers anywhere.** Three sources named — combat, roleplay, exploration — with zero
  point values and no level thresholds.
- **`5. Magic & Spellcasting`** has no cantrip scaling, no ritual casting, and no
  known-vs-prepared distinction.

---

## 3. Gaps that affect the build

### Encounter difficulty has no computable definition

Easy / Medium / Hard / Deadly are described only qualitatively ("likely win with minimal resource
loss"). The DMG's XP-budget-per-level tables are **not SRD/OGL content**, so they cannot be
reused. An original formula is required before an engine or an AI DM can compute difficulty.

### The DM console is entirely unspecified

The UI spec contains sixteen panels, all player-facing. The DM console — roughly 55% of the
app's surface area — has no spec at all. Same for the loot-distribution and AI-narration surfaces
that `Basic Flow` steps 4, 6 and 8 assume exist.

### Dropped sci-fi threads

`2.6 Conditions` ends with *"(Plus custom sci-fi variants)"* — none are ever named.
`6.4` environment tags include **Zero-G** and **Corrupted** alongside mundane tags, with no
supporting mechanics anywhere. Almost certainly vestigial.

**Action:** delete them, or they will end up in the AI DM's context window as unexplained
world-building and it will improvise on them.

### AI-generated stat blocks

`13.2` lets the AI create entirely new monsters — stat blocks, abilities, weaknesses, behaviour.
That is dynamic content generation, and it means generated stat blocks need schema validation and
a sanity check at generation time, not just storage.

---

## 4. Where the doc changes the product plan

**The vision is AI-DM-first.** `1. Overview & Vision` states the goal is removing the dependency
on a human DM, with a *"second iteration where if a DM is present, the app can be used as a side
kick."*

The build order in `docs/requirements-map.html` puts the human-DM digital table (P1) before the
AI DM (P3). That is deliberate and the engineering argument stands — the AI DM can only be as
good as the event vocabulary it speaks, and that vocabulary gets built by making a human drive it
first. Building the model driver first means debugging the vocabulary and the model at the same
time, unable to tell which is broken.

**This is a genuine tension between product instinct and build order.** The resolution used in
the marketing copy: lead with the AI DM, build the human path as scaffolding for it, and don't
market P1 as a product in its own right.

**The ruleset is bigger than a seeded SRD.** Original classes across Monk, Paladin, Ranger,
Rogue, Sorcerer, Warlock and Bard; original races — Orc, Ash-Blooded, Stoneborn, Fae-Touched,
Beastkin; original subclasses; nine levels of spell lists. The content domain needs authoring
tooling and a data model for original classes and subclasses — a meaningfully larger slice of
P1 than a seed script.

---

## 5. Where the art direction came from

The brief was "lava and viking". The handbook is **not** Norse — no runes, sagas, jarls, or
fire-and-ice duality. But the two strongest elemental threads in it are exactly the right ones:

- **Fire** — Ash-Blooded, Ember Resistance, Path of the Wildfire (Flameburst Rage, Burning Steps,
  Cinder Skin, Inferno Surge)
- **Stone** — Stoneborn ("living rock-folk"), the Petrified condition

Fire against stone is lava. The closest existing viking register is already named: Path of the
Iron Howl (Battle Cry, Thunderstride, Howl of Ruin) and College of Battlechants.

The design system is built from that vocabulary rather than pasted onto it. To push harder toward
Norse, the cheap lever is **naming, not visuals** — the mechanical hooks already exist.

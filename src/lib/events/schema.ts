import { z } from "zod";

/**
 * The event vocabulary. Every payload carries its own `v` so a future
 * breaking change to a payload shape adds a new literal instead of mutating
 * one zod schema out from under already-committed rows — see CLAUDE.md,
 * "payload: Json // zod-validated per type, versioned".
 */

export const DAMAGE_TYPES = [
  "acid",
  "bludgeoning",
  "cold",
  "fire",
  "force",
  "lightning",
  "necrotic",
  "piercing",
  "poison",
  "psychic",
  "radiant",
  "slashing",
  "thunder",
] as const;

export const damageTypeSchema = z.enum(DAMAGE_TYPES);
export type DamageType = z.infer<typeof damageTypeSchema>;

export const CONDITIONS = [
  "blinded",
  "charmed",
  "deafened",
  "exhaustion",
  "frightened",
  "grappled",
  "incapacitated",
  "invisible",
  "paralyzed",
  "petrified",
  "poisoned",
  "prone",
  "restrained",
  "stunned",
  "unconscious",
] as const;

export const conditionNameSchema = z.enum(CONDITIONS);
export type ConditionName = z.infer<typeof conditionNameSchema>;

const positionSchema = z.object({
  x: z.number().int(),
  y: z.number().int(),
});

/**
 * `player:<uuid>` isn't a plain enum member, so it can't be a z.literal —
 * matched against the same shape as the events_visibility_check constraint
 * in supabase/migrations/0001_init.sql so a payload that fails here would
 * also fail there.
 */
export const visibilitySchema = z.union([
  z.literal("public"),
  z.literal("dm_only"),
  z
    .string()
    .regex(/^player:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/),
]);
export type Visibility = z.infer<typeof visibilitySchema>;

export const proposedBySchema = z.enum(["human", "model"]);
export type ProposedBy = z.infer<typeof proposedBySchema>;

// ---------------------------------------------------------------------------
// Payload schemas, one per GameEvent type
// ---------------------------------------------------------------------------

const castPayloadSchema = z.object({
  v: z.literal(1),
  spellId: z.string(),
  casterId: z.string(),
  targetIds: z.array(z.string()).min(1),
  /** null = cantrip, cast at no slot level */
  slotLevel: z.number().int().min(0).max(9).nullable(),
  concentration: z.boolean(),
});

const attackPayloadSchema = z.object({
  v: z.literal(1),
  attackerId: z.string(),
  targetId: z.string(),
  roll: z.number().int().min(1).max(20),
  /** Both dice for advantage/disadvantage, or just [roll] for a normal check — see src/lib/dice.ts. */
  rawRolls: z.array(z.number().int().min(1).max(20)).min(1).max(2),
  seed: z.number().int(),
  modifier: z.number().int(),
  total: z.number().int(),
  targetAc: z.number().int(),
  advantage: z.enum(["normal", "advantage", "disadvantage"]),
  critical: z.boolean(),
  hit: z.boolean(),
});

const damagePayloadSchema = z.object({
  v: z.literal(1),
  targetId: z.string(),
  amount: z.number().int().nonnegative(),
  damageType: damageTypeSchema,
  source: z.string().nullable(),
});

const healPayloadSchema = z.object({
  v: z.literal(1),
  targetId: z.string(),
  amount: z.number().int().positive(),
  source: z.string().nullable(),
});

/**
 * Movement is a depletable pool, not an atomic step — see the Combat System
 * §3.3 fix in docs/notion-findings.md. `feetRemaining` is what's left in the
 * actor's pool for the rest of the turn after this move.
 */
const movePayloadSchema = z.object({
  v: z.literal(1),
  actorId: z.string(),
  from: positionSchema,
  to: positionSchema,
  feetSpent: z.number().nonnegative(),
  feetRemaining: z.number().nonnegative(),
});

const conditionPayloadSchema = z.object({
  v: z.literal(1),
  targetId: z.string(),
  condition: conditionNameSchema,
  action: z.enum(["apply", "remove"]),
  durationRounds: z.number().int().positive().nullable(),
  source: z.string().nullable(),
});

const terrainPayloadSchema = z.object({
  v: z.literal(1),
  cell: positionSchema,
  terrainType: z.enum(["difficult", "wall", "hazard", "prop"]),
  destructible: z.boolean(),
});

const destroyPayloadSchema = z.object({
  v: z.literal(1),
  targetId: z.string(),
  cause: z.string().nullable(),
});

const deathPayloadSchema = z.object({
  v: z.literal(1),
  targetId: z.string(),
  cause: z.string().nullable(),
});

/**
 * `reveal` doesn't mutate the hidden event it's revealing — the log is
 * append-only — it commits a new event at a wider visibility. `targetEventId`
 * links back to what's being revealed when this is revealing information
 * rather than map area.
 */
const revealPayloadSchema = z.object({
  v: z.literal(1),
  targetEventId: z.string().nullable(),
  area: z.array(positionSchema).nullable(),
  toVisibility: visibilitySchema,
});

const lootPayloadSchema = z.object({
  v: z.literal(1),
  targetId: z.string(),
  items: z
    .array(
      z.object({
        itemId: z.string().nullable(),
        name: z.string(),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1),
});

const narrationPayloadSchema = z.object({
  v: z.literal(1),
  text: z.string().min(1),
});

const roundPayloadSchema = z.object({
  v: z.literal(1),
  number: z.number().int().positive(),
  phase: z.enum(["start", "end"]),
});

// ---------------------------------------------------------------------------
// Envelope
// ---------------------------------------------------------------------------

function defineEvent<Type extends string, Payload extends z.ZodTypeAny>(
  type: Type,
  payload: Payload,
) {
  const proposed = z.object({
    id: z.string().min(1),
    session_id: z.string().uuid(),
    type: z.literal(type),
    actor: z.string().nullable(),
    payload,
    visibility: visibilitySchema,
    proposed_by: proposedBySchema,
  });

  const committed = proposed.extend({
    seq: z.number().int().nonnegative(),
    committed_at: z.string().datetime({ offset: true }),
  });

  return { proposed, committed };
}

const cast = defineEvent("cast", castPayloadSchema);
const attack = defineEvent("attack", attackPayloadSchema);
const damage = defineEvent("damage", damagePayloadSchema);
const heal = defineEvent("heal", healPayloadSchema);
const move = defineEvent("move", movePayloadSchema);
const condition = defineEvent("condition", conditionPayloadSchema);
const terrain = defineEvent("terrain", terrainPayloadSchema);
const destroy = defineEvent("destroy", destroyPayloadSchema);
const death = defineEvent("death", deathPayloadSchema);
const reveal = defineEvent("reveal", revealPayloadSchema);
const loot = defineEvent("loot", lootPayloadSchema);
const narration = defineEvent("narration", narrationPayloadSchema);
const round = defineEvent("round", roundPayloadSchema);

/** What a DM console or model submits before the engine assigns seq/commit time. */
export const proposedGameEventSchema = z.discriminatedUnion("type", [
  cast.proposed,
  attack.proposed,
  damage.proposed,
  heal.proposed,
  move.proposed,
  condition.proposed,
  terrain.proposed,
  destroy.proposed,
  death.proposed,
  reveal.proposed,
  loot.proposed,
  narration.proposed,
  round.proposed,
]);

/** A row as it exists in `events` once the engine has committed it. */
export const gameEventSchema = z.discriminatedUnion("type", [
  cast.committed,
  attack.committed,
  damage.committed,
  heal.committed,
  move.committed,
  condition.committed,
  terrain.committed,
  destroy.committed,
  death.committed,
  reveal.committed,
  loot.committed,
  narration.committed,
  round.committed,
]);

export type ProposedGameEvent = z.infer<typeof proposedGameEventSchema>;
export type GameEvent = z.infer<typeof gameEventSchema>;
export type EventType = GameEvent["type"];

import { z } from "zod";

export const ABILITY_KEYS = ["str", "dex", "con", "int", "wis", "cha"] as const;
export type AbilityKey = (typeof ABILITY_KEYS)[number];

export const ABILITY_LABELS: Record<AbilityKey, string> = {
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma",
};

// SRD 5.2.1's standard array — the only ability-score generation method
// built so far. Point buy and rolling are real options for later, not
// implemented; every method converges on the same six-number shape below.
export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8] as const;

const abilityScoresSchema = z.object({
  str: z.number().int().min(1).max(30),
  dex: z.number().int().min(1).max(30),
  con: z.number().int().min(1).max(30),
  int: z.number().int().min(1).max(30),
  wis: z.number().int().min(1).max(30),
  cha: z.number().int().min(1).max(30),
});

// v: 1, same versioning reasoning as GameEvent payloads — a future breaking
// change adds v: 2 rather than mutating this shape out from under rows that
// already committed it.
export const characterSheetSchema = z.object({
  v: z.literal(1),
  maxHp: z.number().int().positive(),
  ac: z.number().int().positive(),
  speed: z.number().int().positive(),
  abilityScores: abilityScoresSchema,
  savingThrowProficiencies: z.array(z.enum(ABILITY_KEYS)),
});
export type CharacterSheet = z.infer<typeof characterSheetSchema>;

const DEFAULT_ABILITY_SCORES: Record<AbilityKey, number> = {
  str: 10,
  dex: 10,
  con: 10,
  int: 10,
  wis: 10,
  cha: 10,
};

/**
 * Characters created before ability scores/AC/speed shipped have a bare
 * `{maxHp}` sheet. Every reader goes through here so a legacy row degrades
 * to an untrained baseline (all 10s, AC 10, 30ft speed) instead of a runtime
 * crash on a missing field.
 */
export function readCharacterSheet(raw: unknown): CharacterSheet {
  const parsed = characterSheetSchema.safeParse(raw);
  if (parsed.success) return parsed.data;

  const legacy = (raw ?? {}) as { maxHp?: number; ac?: number };
  return {
    v: 1,
    maxHp: legacy.maxHp ?? 20,
    ac: legacy.ac ?? 10,
    speed: 30,
    abilityScores: { ...DEFAULT_ABILITY_SCORES },
    savingThrowProficiencies: [],
  };
}

export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function formatModifier(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

export function proficiencyBonusForLevel(level: number): number {
  return 2 + Math.floor((level - 1) / 4);
}

// No skill-proficiency system exists yet (Perception included), so this is
// always the untrained value — 10 + WIS mod, no proficiency bonus.
export function passivePerception(sheet: CharacterSheet): number {
  return 10 + abilityModifier(sheet.abilityScores.wis);
}

export function initiativeModifier(sheet: CharacterSheet): number {
  return abilityModifier(sheet.abilityScores.dex);
}

export function savingThrowModifier(
  sheet: CharacterSheet,
  ability: AbilityKey,
  level: number,
): number {
  const base = abilityModifier(sheet.abilityScores[ability]);
  return sheet.savingThrowProficiencies.includes(ability)
    ? base + proficiencyBonusForLevel(level)
    : base;
}

import { randomInt } from "crypto";

/**
 * Server-side dice rolling — CLAUDE.md's "Dice are rolled server-side.
 * Seeded, logged, auditable." The seed is generated with crypto (so a
 * client can never predict or supply it) but is itself just a number, so
 * once it's committed as part of an event's payload, anyone with DB access
 * can re-run mulberry32(seed) and get the exact same sequence of rolls back
 * — that's the audit trail, not a separate log.
 */
function mulberry32(seed: number) {
  let state = seed | 0;
  return function next() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type DiceRoll = { rolls: number[]; seed: number };

/** `count` dice of `sides` faces, drawn in order from one seeded sequence. */
export function rollDice(sides: number, count: number, seed?: number): DiceRoll {
  const usedSeed = seed ?? randomInt(0, 2 ** 31);
  const next = mulberry32(usedSeed);
  const rolls = Array.from({ length: count }, () => Math.floor(next() * sides) + 1);
  return { rolls, seed: usedSeed };
}

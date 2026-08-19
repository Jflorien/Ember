export type DescribableEvent = { type: string; payload: Record<string, unknown> };

/** Resolves a character id to a display name; returns undefined if unknown. */
export type NameLookup = (characterId: string) => string | undefined;

function nameOf(
  payload: Record<string, unknown>,
  key: string,
  lookup?: NameLookup,
  fallback = "Someone",
): string {
  const id = payload[key];
  if (typeof id !== "string") return fallback;
  return lookup?.(id) ?? fallback;
}

function cellOf(payload: Record<string, unknown>, key: string): string | null {
  const cell = payload[key] as { x?: unknown; y?: unknown } | undefined;
  if (!cell || typeof cell.x !== "number" || typeof cell.y !== "number") return null;
  return `${cell.x}, ${cell.y}`;
}

/**
 * Human-readable line for a committed event, shared by LiveEventFeed and
 * TvEventFeed. Every event type in the union has a case — an event that
 * renders as a bare `[damage]` is the log admitting it doesn't know what
 * happened, which is exactly the wrong impression for the one panel everyone
 * at the table is reading.
 *
 * `lookup` resolves character ids to names. It's optional so the fallback
 * ("Someone") still reads as a sentence when a caller has no roster to hand,
 * and so events committed before a given name existed still describe
 * correctly — the alternative, denormalising a name into every payload, would
 * only have fixed events committed after the change.
 */
export function describeEvent(event: DescribableEvent, lookup?: NameLookup): string {
  const payload = event.payload ?? {};

  if (event.type === "narration" && typeof payload.text === "string") {
    return payload.text;
  }

  if (event.type === "attack") {
    const { roll, modifier, total, targetAc, critical, hit } = payload;
    if (
      typeof roll === "number" &&
      typeof modifier === "number" &&
      typeof total === "number" &&
      typeof targetAc === "number"
    ) {
      const sign = modifier >= 0 ? "+" : "";
      const outcome = critical ? "CRITICAL HIT" : hit ? "Hit" : "Miss";
      const attacker = nameOf(payload, "attackerId", lookup, "Attack");
      const target = nameOf(payload, "targetId", lookup, "the target");
      const who = attacker === "Attack" ? "Attack" : `${attacker} → ${target}`;
      return `${who}: ${roll}${sign}${modifier} = ${total} vs AC ${targetAc} — ${outcome}`;
    }
  }

  if (event.type === "damage" && typeof payload.amount === "number") {
    const target = nameOf(payload, "targetId", lookup);
    const type = typeof payload.damageType === "string" ? ` ${payload.damageType}` : "";
    const source = typeof payload.source === "string" ? ` (${payload.source})` : "";
    return `${target} takes ${payload.amount}${type} damage${source}`;
  }

  if (event.type === "heal" && typeof payload.amount === "number") {
    const target = nameOf(payload, "targetId", lookup);
    const source = typeof payload.source === "string" ? ` (${payload.source})` : "";
    return `${target} heals ${payload.amount}${source}`;
  }

  if (event.type === "condition" && typeof payload.condition === "string") {
    const target = nameOf(payload, "targetId", lookup);
    const rounds =
      typeof payload.durationRounds === "number" ? ` for ${payload.durationRounds} rounds` : "";
    return payload.action === "remove"
      ? `${target} is no longer ${payload.condition}`
      : `${target} is ${payload.condition}${rounds}`;
  }

  if (event.type === "move") {
    const to = cellOf(payload, "to");
    if (to) {
      const actor = nameOf(payload, "actorId", lookup);
      const feet = typeof payload.feetSpent === "number" ? ` (${payload.feetSpent} ft)` : "";
      return `${actor} moves to ${to}${feet}`;
    }
  }

  if (event.type === "terrain" && typeof payload.terrainType === "string") {
    const cell = cellOf(payload, "cell");
    return cell ? `${payload.terrainType} placed at ${cell}` : `${payload.terrainType} placed`;
  }

  if (event.type === "round" && typeof payload.number === "number") {
    return payload.phase === "end" ? `Round ${payload.number} ends` : `Round ${payload.number} begins`;
  }

  if (event.type === "cast" && typeof payload.spellName === "string") {
    const targetCount = Array.isArray(payload.targetIds) ? payload.targetIds.length : 0;
    const slotLevel = payload.slotLevel;
    const level = typeof slotLevel === "number" ? `slot ${slotLevel}` : "cantrip";
    const caster = nameOf(payload, "casterId", lookup, "");
    const targets = targetCount === 1 ? "1 target" : `${targetCount} targets`;
    const who = caster ? `${caster} casts` : "Cast:";
    return `${who} ${payload.spellName} (${level}) — ${targets}`;
  }

  if (event.type === "destroy") {
    const cell = cellOf(payload, "cell");
    const cause = typeof payload.cause === "string" ? payload.cause : null;
    const where = cell ? ` at ${cell}` : "";
    return cause ? `Destroyed${where}: ${cause}` : `Destroyed${where}: terrain gave way`;
  }

  if (event.type === "reveal" && typeof payload.description === "string") {
    return `Revealed: ${payload.description}`;
  }

  if (event.type === "death") {
    const name =
      typeof payload.characterName === "string"
        ? payload.characterName
        : nameOf(payload, "targetId", lookup, "A character");
    const cause = typeof payload.cause === "string" ? payload.cause : null;
    return cause ? `${name} died — ${cause}` : `${name} died`;
  }

  if (event.type === "loot" && Array.isArray(payload.items)) {
    const items = payload.items as Array<{ name?: unknown; quantity?: unknown }>;
    const summary = items
      .filter((item) => typeof item.name === "string")
      .map((item) => (typeof item.quantity === "number" ? `${item.quantity}× ${item.name}` : item.name))
      .join(", ");
    if (summary) {
      const target = nameOf(payload, "targetId", lookup, "");
      return target ? `${target} finds ${summary}` : `Loot: ${summary}`;
    }
  }

  return `[${event.type}]`;
}

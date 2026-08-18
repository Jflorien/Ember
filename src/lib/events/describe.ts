export type DescribableEvent = { type: string; payload: Record<string, unknown> };

/**
 * Human-readable line for a committed event, shared by LiveEventFeed and
 * TvEventFeed (previously each had its own copy of the narration-only
 * version of this). Anything without a specific case falls back to
 * `[type]`, same as before.
 */
export function describeEvent(event: DescribableEvent): string {
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
      return `Attack: ${roll}${sign}${modifier} = ${total} vs AC ${targetAc} — ${outcome}`;
    }
  }

  if (event.type === "cast" && typeof payload.spellName === "string") {
    const targetCount = Array.isArray(payload.targetIds) ? payload.targetIds.length : 0;
    const slotLevel = payload.slotLevel;
    const level = typeof slotLevel === "number" ? `slot ${slotLevel}` : "cantrip";
    const targets = targetCount === 1 ? "1 target" : `${targetCount} targets`;
    return `Cast: ${payload.spellName} (${level}) — ${targets}`;
  }

  if (event.type === "loot" && Array.isArray(payload.items)) {
    const items = payload.items as Array<{ name?: unknown; quantity?: unknown }>;
    const summary = items
      .filter((item) => typeof item.name === "string")
      .map((item) => (typeof item.quantity === "number" ? `${item.quantity}× ${item.name}` : item.name))
      .join(", ");
    if (summary) return `Loot: ${summary}`;
  }

  return `[${event.type}]`;
}

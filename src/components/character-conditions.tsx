"use client";

import { useCharacterConditions } from "@/lib/hooks/use-character-conditions";
import { ConditionPill } from "@/components/condition-pill";

export function CharacterConditions({
  sessionId,
  characterId,
}: {
  sessionId: string;
  characterId: string;
}) {
  const conditions = useCharacterConditions(sessionId, characterId);
  const active = Object.entries(conditions).filter(([, v]) => v.active);

  if (active.length === 0) {
    return <p className="font-mono text-sm text-ash-500">No active conditions.</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {active.map(([name, { durationRounds }]) => (
        <ConditionPill
          key={name}
          name={name}
          kind="debuff"
          duration={durationRounds ? `${durationRounds}r` : undefined}
        />
      ))}
    </div>
  );
}

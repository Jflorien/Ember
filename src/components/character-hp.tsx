"use client";

import { useCharacterHp } from "@/lib/hooks/use-character-hp";
import { HpBar } from "@/components/hp-bar";

export function CharacterHp({
  sessionId,
  characterId,
  maxHp,
  label,
}: {
  sessionId: string;
  characterId: string;
  maxHp: number;
  label?: string;
}) {
  const current = useCharacterHp(sessionId, characterId, maxHp);
  return <HpBar current={current} max={maxHp} label={label} />;
}

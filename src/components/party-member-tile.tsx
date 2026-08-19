"use client";

import { useCharacterHp } from "@/lib/hooks/use-character-hp";
import { useCharacterConditions } from "@/lib/hooks/use-character-conditions";
import { HpBar } from "@/components/hp-bar";
import { PortraitThumb } from "@/components/portrait-thumb";

export function PartyMemberTile({
  sessionId,
  characterId,
  name,
  maxHp,
  portraitUrl,
}: {
  sessionId: string;
  characterId: string;
  name: string;
  maxHp: number;
  portraitUrl?: string | null;
}) {
  const current = useCharacterHp(sessionId, characterId, maxHp);
  const conditions = useCharacterConditions(sessionId, characterId);
  const activeConditions = Object.keys(conditions).filter((name) => conditions[name].active);

  return (
    <div className="plate flex min-w-[160px] flex-col gap-2 p-3">
      <div className="flex items-center gap-2">
        <PortraitThumb url={portraitUrl ?? null} name={name} size={24} />
        <span className="truncate text-sm font-semibold text-ash-100">{name}</span>
      </div>
      <HpBar current={current} max={maxHp} label="" />
      {activeConditions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {activeConditions.map((name) => (
            <span
              key={name}
              title={name}
              className="h-2 w-2 shrink-0 rounded-full bg-shadow shadow-[0_0_6px_var(--shadow)]"
            />
          ))}
        </div>
      )}
    </div>
  );
}

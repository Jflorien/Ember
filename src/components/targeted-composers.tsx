"use client";

import { useState } from "react";
import type { PartyMember, Spell } from "@/app/dm/actions";
import { AttackComposer } from "@/components/attack-composer";
import { DamageHealComposer } from "@/components/damage-heal-composer";
import { ConditionComposer } from "@/components/condition-composer";
import { LootComposer } from "@/components/loot-composer";
import { CastComposer } from "@/components/cast-composer";
import { DeathComposer } from "@/components/death-composer";

/**
 * The DM console's attack/damage/heal/condition/cast composers, plus the
 * pickers that decide who they act on. Attacker/target selection is in-page
 * state (a session of "who am I acting on right now" changes far more often
 * than the page itself), unlike the campaign switcher, which is real
 * navigation. The Attacker picker doubles as "caster" for Cast.
 */
export function TargetedComposers({
  sessionId,
  members,
  spells,
}: {
  sessionId: string;
  members: PartyMember[];
  spells: Spell[];
}) {
  const [targetId, setTargetId] = useState(members[0]?.characterId ?? "");
  const [attackerId, setAttackerId] = useState(members[0]?.characterId ?? "");

  if (members.length === 0) {
    return (
      <p className="font-mono text-sm text-ash-500">
        No characters in this campaign yet — share the invite code above and
        have a player create one on /play.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-4">
        <div className="max-w-xs">
          <label htmlFor="attacker-picker" className="runic mb-2 block">
            Attacker
          </label>
          <select
            id="attacker-picker"
            value={attackerId}
            onChange={(event) => setAttackerId(event.target.value)}
            className="w-full bg-basalt-900 px-3 py-2 text-sm text-ash-100 focus:outline-none focus:shadow-[inset_0_0_0_1px_var(--forge-500)]"
          >
            {members.map((member) => (
              <option key={member.characterId} value={member.characterId}>
                {member.name}
              </option>
            ))}
          </select>
        </div>

        <div className="max-w-xs">
          <label htmlFor="target-picker" className="runic mb-2 block">
            Target
          </label>
          <select
            id="target-picker"
            value={targetId}
            onChange={(event) => setTargetId(event.target.value)}
            className="w-full bg-basalt-900 px-3 py-2 text-sm text-ash-100 focus:outline-none focus:shadow-[inset_0_0_0_1px_var(--forge-500)]"
          >
            {members.map((member) => (
              <option key={member.characterId} value={member.characterId}>
                {member.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <AttackComposer
        sessionId={sessionId}
        attackerId={attackerId}
        targetId={targetId}
        members={members}
      />
      <DamageHealComposer sessionId={sessionId} targetId={targetId} members={members} />
      <ConditionComposer sessionId={sessionId} targetId={targetId} members={members} />
      <LootComposer sessionId={sessionId} targetId={targetId} members={members} />
      <CastComposer
        sessionId={sessionId}
        casterId={attackerId}
        targetId={targetId}
        spells={spells}
        members={members}
      />
      <DeathComposer
        sessionId={sessionId}
        targetId={targetId}
        targetName={
          members.find((member) => member.characterId === targetId)?.name ?? "this character"
        }
        members={members}
      />
    </div>
  );
}

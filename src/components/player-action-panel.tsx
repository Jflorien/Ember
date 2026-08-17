"use client";

import { useState } from "react";
import type { PartyMember } from "@/app/dm/actions";
import { AttackComposer } from "@/components/attack-composer";
import { DamageHealComposer } from "@/components/damage-heal-composer";
import { ConditionComposer } from "@/components/condition-composer";

/**
 * The player's own actions — the counterpart to the DM console's
 * TargetedComposers, scoped by the same RLS policy that makes this safe
 * (events_insert_player_self_action, 0006_player_self_action_events.sql):
 * a player can attack with their own character against anyone, and can
 * self-report damage/heal/condition happening to their own character, but
 * can't touch anyone else's HP or conditions directly. No attacker or
 * target-for-self-report picker is needed — both are always "me."
 */
export function PlayerActionPanel({
  sessionId,
  characterId,
  members,
}: {
  sessionId: string;
  characterId: string;
  members: PartyMember[];
}) {
  const attackTargets = members.filter((member) => member.characterId !== characterId);
  const [targetId, setTargetId] = useState(attackTargets[0]?.characterId ?? "");

  return (
    <div className="flex flex-col gap-4">
      {attackTargets.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="max-w-xs">
            <label htmlFor="player-target-picker" className="runic mb-2 block">
              Attack target
            </label>
            <select
              id="player-target-picker"
              value={targetId}
              onChange={(event) => setTargetId(event.target.value)}
              className="w-full bg-basalt-900 px-3 py-2 text-sm text-ash-100 focus:outline-none focus:shadow-[inset_0_0_0_1px_var(--forge-500)]"
            >
              {attackTargets.map((member) => (
                <option key={member.characterId} value={member.characterId}>
                  {member.name}
                </option>
              ))}
            </select>
          </div>
          <AttackComposer sessionId={sessionId} attackerId={characterId} targetId={targetId} />
        </div>
      )}

      <div className="flex flex-col gap-3">
        <span className="runic">Self-report</span>
        <DamageHealComposer sessionId={sessionId} targetId={characterId} />
        <ConditionComposer sessionId={sessionId} targetId={characterId} />
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import type { PartyMember, Spell } from "@/app/dm/actions";
import { EventComposer } from "@/components/event-composer";
import { AttackComposer } from "@/components/attack-composer";
import { DamageHealComposer } from "@/components/damage-heal-composer";
import { ConditionComposer } from "@/components/condition-composer";
import { LootComposer } from "@/components/loot-composer";
import { CastComposer } from "@/components/cast-composer";
import { DeathComposer } from "@/components/death-composer";

const TABS = [
  { id: "narration", label: "Narration" },
  { id: "attack", label: "Attack" },
  { id: "damage", label: "Damage / Heal" },
  { id: "condition", label: "Condition" },
  { id: "cast", label: "Cast" },
  { id: "loot", label: "Loot" },
  { id: "death", label: "Death" },
] as const;

type TabId = (typeof TABS)[number]["id"];

/**
 * DM Console Panels §"Event Console". Previously every composer rendered at
 * once — eight stacked forms the DM had to scroll past to reach the one they
 * wanted, which read as a test harness rather than a console. One at a time,
 * behind tabs: the DM is doing exactly one thing at any moment in a session.
 *
 * Switching tabs unmounts the previous composer, which clears its inputs and
 * any error. That's deliberate — a half-typed damage amount shouldn't still
 * be sitting there when you come back from casting a spell.
 *
 * Attacker/target pickers live above the tabs rather than inside each
 * composer, because they're shared context ("who am I acting on right now")
 * that shouldn't reset every time the DM switches action.
 */
export function EventConsole({
  sessionId,
  members,
  spells,
}: {
  sessionId: string;
  members: PartyMember[];
  spells: Spell[];
}) {
  const [tab, setTab] = useState<TabId>("narration");
  const [targetId, setTargetId] = useState(members[0]?.characterId ?? "");
  const [attackerId, setAttackerId] = useState(members[0]?.characterId ?? "");

  if (members.length === 0) {
    return (
      <p className="font-mono text-sm text-ash-500">
        No characters in this campaign yet — share the invite code and have a player create
        one, and the full event console appears here.
      </p>
    );
  }

  const needsActor = tab === "attack" || tab === "cast";
  const needsTarget = tab !== "narration";
  const targetName =
    members.find((member) => member.characterId === targetId)?.name ?? "this character";

  return (
    <div className="flex flex-col gap-4">
      {/* Molten underline, not forge — gold stays reserved for turn state. */}
      <div className="flex flex-wrap gap-1 border-b border-basalt-700">
        {TABS.map((entry) => {
          const active = tab === entry.id;
          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => setTab(entry.id)}
              aria-current={active ? "true" : undefined}
              className={
                "border-b-2 px-3 py-2 text-xs font-semibold transition-colors " +
                (active
                  ? "border-b-molten-500 text-ash-050"
                  : "border-b-transparent text-ash-500 hover:text-ash-100")
              }
            >
              {entry.label}
            </button>
          );
        })}
      </div>

      {(needsActor || needsTarget) && (
        <div className="flex flex-wrap gap-3">
          {needsActor && (
            <Picker
              id="actor-picker"
              label={tab === "cast" ? "Caster" : "Attacker"}
              value={attackerId}
              onChange={setAttackerId}
              members={members}
            />
          )}
          {needsTarget && (
            <Picker
              id="target-picker"
              label="Target"
              value={targetId}
              onChange={setTargetId}
              members={members}
            />
          )}
        </div>
      )}

      {tab === "narration" && <EventComposer sessionId={sessionId} members={members} />}
      {tab === "attack" && (
        <AttackComposer
          sessionId={sessionId}
          attackerId={attackerId}
          targetId={targetId}
          members={members}
        />
      )}
      {tab === "damage" && (
        <DamageHealComposer sessionId={sessionId} targetId={targetId} members={members} />
      )}
      {tab === "condition" && (
        <ConditionComposer sessionId={sessionId} targetId={targetId} members={members} />
      )}
      {tab === "cast" && (
        <CastComposer
          sessionId={sessionId}
          casterId={attackerId}
          targetId={targetId}
          spells={spells}
          members={members}
        />
      )}
      {tab === "loot" && (
        <LootComposer sessionId={sessionId} targetId={targetId} members={members} />
      )}
      {tab === "death" && (
        <DeathComposer
          sessionId={sessionId}
          targetId={targetId}
          targetName={targetName}
          members={members}
        />
      )}
    </div>
  );
}

function Picker({
  id,
  label,
  value,
  onChange,
  members,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  members: PartyMember[];
}) {
  return (
    <div className="min-w-[10rem] flex-1">
      <label htmlFor={id} className="runic mb-1.5 block">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full bg-basalt-900 px-3 py-2 text-sm text-ash-100 focus:outline-none focus:shadow-[inset_0_0_0_1px_var(--forge-500)]"
      >
        {members.map((member) => (
          <option key={member.characterId} value={member.characterId}>
            {member.name}
          </option>
        ))}
      </select>
    </div>
  );
}

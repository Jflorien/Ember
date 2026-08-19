"use client";

import { useActionState, useState } from "react";
import { createCharacter, type EventActionState } from "@/app/dm/actions";
import { SubmitButton } from "@/components/submit-button";
import {
  ABILITY_KEYS,
  ABILITY_LABELS,
  STANDARD_ARRAY,
  abilityModifier,
  formatModifier,
  type AbilityKey,
} from "@/lib/characters/sheet";

const initialState: EventActionState = {};

// A reasonable starting bijection onto the standard array — every value
// still gets reassigned freely via the swap-on-collision selects below.
const DEFAULT_ASSIGNMENT: Record<AbilityKey, number> = {
  str: 15,
  dex: 14,
  con: 13,
  int: 12,
  wis: 10,
  cha: 8,
};

export function CreateCharacterForm({ campaignId }: { campaignId: string }) {
  const action = createCharacter.bind(null, campaignId);
  const [state, formAction] = useActionState(action, initialState);

  const [assignment, setAssignment] = useState<Record<AbilityKey, number>>(DEFAULT_ASSIGNMENT);
  const [saveProficiencies, setSaveProficiencies] = useState<Set<AbilityKey>>(new Set());

  // Standard-array assignment as a bijection: picking a value already used
  // by another ability swaps the two, so every value stays used exactly
  // once and the server-side "each value used once" check never fails.
  function handleAssign(ability: AbilityKey, value: number) {
    setAssignment((prev) => {
      const swapWith = (Object.keys(prev) as AbilityKey[]).find(
        (key) => key !== ability && prev[key] === value,
      );
      const next = { ...prev, [ability]: value };
      if (swapWith) next[swapWith] = prev[ability];
      return next;
    });
  }

  function toggleSave(ability: AbilityKey) {
    setSaveProficiencies((prev) => {
      const next = new Set(prev);
      if (next.has(ability)) next.delete(ability);
      else next.add(ability);
      return next;
    });
  }

  const dexMod = abilityModifier(assignment.dex);

  return (
    <form action={formAction} className="plate flex flex-col gap-4 p-6">
      <span className="runic hot">Create your character</span>
      <p className="text-sm text-ash-300">
        Ability scores use the SRD standard array. Point buy and rolling aren&rsquo;t built
        yet.
      </p>

      <div className="field max-w-none">
        <label htmlFor="character-name">Character name</label>
        <input id="character-name" name="name" type="text" required placeholder="Rowan Ashbound" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="field max-w-none">
          <label htmlFor="character-class">Class</label>
          <input id="character-class" name="class" type="text" placeholder="Wildfire Barbarian" />
        </div>
        <div className="field max-w-none">
          <label htmlFor="character-level">Level</label>
          <input
            id="character-level"
            name="level"
            type="number"
            min={1}
            max={20}
            step={1}
            defaultValue={1}
          />
        </div>
      </div>

      <div>
        <div className="runic mb-2">Ability scores</div>
        <div className="grid grid-cols-3 gap-3">
          {ABILITY_KEYS.map((key) => (
            <div key={key} className="field max-w-none">
              <label htmlFor={`ability-${key}`}>{key.toUpperCase()}</label>
              <select
                id={`ability-${key}`}
                name={`ability-${key}`}
                value={assignment[key]}
                onChange={(event) => handleAssign(key, Number(event.target.value))}
                className="w-full bg-basalt-900 px-3 py-2 text-sm text-ash-100 focus:outline-none focus:shadow-[inset_0_0_0_1px_var(--forge-500)]"
              >
                {STANDARD_ARRAY.map((value) => (
                  <option key={value} value={value}>
                    {value} ({formatModifier(abilityModifier(value))})
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="field max-w-none">
          <label htmlFor="character-ac">Armor class</label>
          <input
            id="character-ac"
            name="ac"
            type="number"
            min={1}
            placeholder={String(10 + dexMod)}
          />
          <span className="mt-1 block text-xs text-ash-500">
            Defaults to unarmored ({10 + dexMod}) if left blank.
          </span>
        </div>
        <div className="field max-w-none">
          <label htmlFor="character-speed">Speed (ft)</label>
          <input id="character-speed" name="speed" type="number" min={0} placeholder="30" />
        </div>
      </div>

      <div>
        <div className="runic mb-2">Saving throw proficiencies</div>
        <div className="flex flex-wrap gap-3">
          {ABILITY_KEYS.map((key) => (
            <label key={key} className="flex items-center gap-1.5 text-sm text-ash-200">
              <input
                type="checkbox"
                name="saveProficiencies"
                value={key}
                checked={saveProficiencies.has(key)}
                onChange={() => toggleSave(key)}
                className="accent-forge-500"
              />
              {ABILITY_LABELS[key]}
            </label>
          ))}
        </div>
      </div>

      <SubmitButton>Create character</SubmitButton>
      {state.error && (
        <p className="text-sm text-[#ff8f92]" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}

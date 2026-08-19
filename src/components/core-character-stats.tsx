import {
  ABILITY_KEYS,
  abilityModifier,
  formatModifier,
  initiativeModifier,
  passivePerception,
  savingThrowModifier,
  type CharacterSheet,
} from "@/lib/characters/sheet";

/**
 * In-Session Player Dashboard Panels §2, "Core Character Stats Panel" — the
 * at-a-glance section. HP has its own live, event-folded component
 * (CharacterHp); everything here is static per the character's sheet, no
 * Realtime needed. No skill-proficiency system exists yet, so Passive
 * Perception is always the untrained value (10 + WIS mod).
 */
export function CoreCharacterStats({
  sheet,
  level,
}: {
  sheet: CharacterSheet;
  level: number;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-3">
        <StatTile label="AC" value={String(sheet.ac)} />
        <StatTile label="Initiative" value={formatModifier(initiativeModifier(sheet))} />
        <StatTile label="Speed" value={`${sheet.speed} ft`} />
      </div>

      <div>
        <div className="runic mb-2">Ability scores</div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {ABILITY_KEYS.map((key) => {
            const score = sheet.abilityScores[key];
            return (
              <div key={key} className="plate flex flex-col items-center gap-1 p-2">
                <span className="font-mono text-[10px] uppercase text-ash-500">{key}</span>
                <span className="font-mono text-lg font-semibold tabular-nums text-ash-050">
                  {score}
                </span>
                <span className="font-mono text-xs tabular-nums text-forge-400">
                  {formatModifier(abilityModifier(score))}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <div className="runic mb-2">Saving throws</div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {ABILITY_KEYS.map((key) => {
            const proficient = sheet.savingThrowProficiencies.includes(key);
            return (
              <div
                key={key}
                className={
                  "flex items-center justify-between px-2 py-1.5 text-xs " +
                  (proficient
                    ? "bg-forge-500/10 text-forge-300 shadow-[inset_0_0_0_1px_var(--forge-500)]"
                    : "bg-basalt-900 text-ash-400")
                }
              >
                <span className="uppercase">{key}</span>
                <span className="font-mono tabular-nums">
                  {formatModifier(savingThrowModifier(sheet, key, level))}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <StatTile label="Passive Perception" value={String(passivePerception(sheet))} wide />
    </div>
  );
}

function StatTile({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={"plate flex flex-col gap-1 p-3 " + (wide ? "col-span-3" : "")}>
      <span className="runic text-xs">{label}</span>
      <span className="font-mono text-xl font-semibold tabular-nums text-ash-050">{value}</span>
    </div>
  );
}

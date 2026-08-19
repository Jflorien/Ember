import Link from "next/link";
import { getMyCharacters, type RosterCharacter } from "@/app/dm/actions";
import { PortraitThumb } from "@/components/portrait-thumb";
import { formatModifier, initiativeModifier } from "@/lib/characters/sheet";

export const dynamic = "force-dynamic";

/**
 * Character Roster Panel (Player Meta Panels, Notion) — every character this
 * account owns, split living/fallen. "Dead" is folded from committed `death`
 * events, not a column: see getMyCharacters. The spec's "Archived" status and
 * its Edit/Archive actions aren't built — there's no post-creation character
 * editor yet, and archiving needs a state that isn't death.
 */
export default async function CharactersPage() {
  const characters = await getMyCharacters();
  const living = characters.filter((character) => !character.dead);
  const fallen = characters.filter((character) => character.dead);

  return (
    <>
      <div>
        <span className="runic hot">Characters</span>
        <h1 className="font-display mt-4 text-2xl font-bold tracking-tight text-ash-050">
          Everyone you&rsquo;ve played.
        </h1>
      </div>

      <Link href="/play/characters/new" className="btn btn-forge text-center">
        Create new character
      </Link>

      <section>
        <div className="runic mb-3">Living — {living.length}</div>
        {living.length === 0 ? (
          <p className="font-mono text-sm text-ash-500">
            No living characters. Create one to get back to a table.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {living.map((character) => (
              <CharacterRow key={character.characterId} character={character} />
            ))}
          </ul>
        )}
      </section>

      {fallen.length > 0 && (
        <section>
          <div className="runic mb-3">Fallen — {fallen.length}</div>
          <ul className="flex flex-col gap-2">
            {fallen.map((character) => (
              <CharacterRow key={character.characterId} character={character} />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function CharacterRow({ character }: { character: RosterCharacter }) {
  const { sheet, dead } = character;

  return (
    <li
      className={
        "plate flex flex-col gap-3 p-4 " + (dead ? "opacity-60" : "")
      }
    >
      <div className="flex items-center gap-3">
        <PortraitThumb url={character.portraitUrl} name={character.name} size={40} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-ash-100">
              {character.name}
            </span>
            {/* Never colour alone: the dagger and the word both carry it. */}
            {dead && (
              <span className="shrink-0 border border-basalt-600 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ash-400">
                † Dead
              </span>
            )}
          </div>
          <div className="truncate font-mono text-xs text-ash-500">
            {character.class ? `${character.class} · ` : ""}Level {character.level}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 font-mono text-xs">
        <Stat label="HP" value={String(sheet.maxHp)} />
        <Stat label="AC" value={String(sheet.ac)} />
        <Stat label="Init" value={formatModifier(initiativeModifier(sheet))} />
        <Stat label="Speed" value={`${sheet.speed}`} />
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-basalt-700 pt-3">
        <span className="min-w-0 truncate text-xs text-ash-400">
          {character.campaignName}
          {dead && character.causeOfDeath ? ` · ${character.causeOfDeath}` : ""}
        </span>
        {!dead && (
          <Link
            href={`/play/session?campaign=${character.campaignId}`}
            className="btn btn-iron shrink-0 text-xs"
          >
            Enter game
          </Link>
        )}
      </div>
    </li>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-basalt-900 px-2 py-1.5">
      <div className="text-[10px] uppercase text-ash-500">{label}</div>
      <div className="tabular-nums text-ash-100">{value}</div>
    </div>
  );
}

import Link from "next/link";
import { getMyPlayerCampaigns, getMyCharacters } from "@/app/dm/actions";
import { PortraitThumb } from "@/components/portrait-thumb";

export const dynamic = "force-dynamic";

/**
 * Player Home / Landing Panel (Player Meta Panels, Notion): the hub a
 * logged-in player lands on — campaigns they're in, a roster summary, and
 * the quick actions that reach the other tabs. Session status, DM name and
 * next-session date from that spec aren't here: `sessions.status` exists but
 * nothing sets it beyond 'active', and there's no scheduling model at all.
 */
export default async function PlayerHomePage() {
  const [campaigns, characters] = await Promise.all([
    getMyPlayerCampaigns(),
    getMyCharacters(),
  ]);

  const living = characters.filter((character) => !character.dead);

  return (
    <>
      <div>
        <span className="runic hot">Player dashboard</span>
        <h1 className="font-display mt-4 text-2xl font-bold tracking-tight text-ash-050">
          Your table, between sessions.
        </h1>
      </div>

      <section>
        <div className="runic mb-3">Your campaigns</div>
        {campaigns.length === 0 ? (
          <div className="plate flex flex-col gap-3 p-6">
            <p className="text-sm text-ash-300">
              You haven&rsquo;t joined a campaign yet. Ask your DM for their invite code.
            </p>
            <Link href="/play/session?join=1" className="btn btn-forge text-center">
              Join a campaign
            </Link>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {campaigns.map((campaign) => {
              const inThis = living.filter(
                (character) => character.campaignId === campaign.id,
              );
              return (
                <li key={campaign.id} className="plate flex items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-ash-100">
                      {campaign.name}
                    </div>
                    <div className="font-mono text-xs text-ash-500">
                      {inThis.length > 0
                        ? inThis.map((character) => character.name).join(", ")
                        : "No living character here"}
                    </div>
                  </div>
                  <Link
                    href={`/play/session?campaign=${campaign.id}`}
                    className="btn btn-iron shrink-0 text-xs"
                  >
                    Enter
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <div className="runic mb-3">Character roster</div>
        {characters.length === 0 ? (
          <p className="font-mono text-sm text-ash-500">No characters yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {characters.slice(0, 3).map((character) => (
              <li key={character.characterId} className="plate flex items-center gap-3 p-3">
                <PortraitThumb
                  url={character.portraitUrl}
                  name={character.name}
                  size={32}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-ash-100">
                    {character.name}
                    {character.dead && (
                      <span className="ml-2 font-mono text-[10px] uppercase text-ash-500">
                        † dead
                      </span>
                    )}
                  </div>
                  <div className="truncate font-mono text-xs text-ash-500">
                    {character.class ? `${character.class}, ` : ""}Lv {character.level} ·{" "}
                    {character.campaignName}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        {characters.length > 3 && (
          <Link
            href="/play/characters"
            className="mt-2 inline-block text-xs text-ash-400 hover:text-ash-100"
          >
            View all {characters.length} characters →
          </Link>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <div className="runic mb-1">Quick actions</div>
        <Link href="/play/characters/new" className="btn btn-iron text-center">
          Create new character
        </Link>
        <Link href="/play/session?join=1" className="btn btn-iron text-center">
          Join a campaign
        </Link>
        <Link href="/play/characters" className="btn btn-iron text-center">
          View all characters
        </Link>
      </section>
    </>
  );
}

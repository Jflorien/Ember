import Link from "next/link";
import { getMyPlayerCampaigns } from "@/app/dm/actions";
import { CreateCharacterForm } from "@/components/create-character-form";

export const dynamic = "force-dynamic";

/**
 * Character creation, on its own route now instead of appearing inline on
 * the session screen when a player happened to have no character. A
 * character belongs to exactly one campaign, so picking that campaign is
 * step one — as navigation (`?campaign=`), the same shape CampaignSwitcher
 * uses, rather than in-page state.
 */
export default async function NewCharacterPage({
  searchParams,
}: {
  searchParams: Promise<{ campaign?: string }>;
}) {
  const { campaign: campaignIdParam } = await searchParams;
  const campaigns = await getMyPlayerCampaigns();

  const selected = campaignIdParam
    ? campaigns.find((campaign) => campaign.id === campaignIdParam)
    : undefined;

  if (campaigns.length === 0) {
    return (
      <>
        <Heading />
        <div className="plate flex flex-col gap-3 p-6">
          <p className="text-sm text-ash-300">
            A character belongs to a campaign, and you aren&rsquo;t in one yet. Join a table
            first — your DM has the invite code.
          </p>
          <Link href="/play/session?join=1" className="btn btn-forge text-center">
            Join a campaign
          </Link>
        </div>
      </>
    );
  }

  if (!selected) {
    return (
      <>
        <Heading />
        <section>
          <div className="runic mb-3">Which campaign?</div>
          <ul className="flex flex-col gap-2">
            {campaigns.map((campaign) => (
              <li key={campaign.id}>
                <Link
                  href={`/play/characters/new?campaign=${campaign.id}`}
                  className="plate flex items-center justify-between gap-3 p-4 hover:bg-basalt-750"
                >
                  <span className="truncate text-sm text-ash-100">{campaign.name}</span>
                  <span className="shrink-0 font-mono text-xs text-ash-500">Choose →</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </>
    );
  }

  return (
    <>
      <Heading />
      <p className="text-sm text-ash-300">
        For <span className="text-ash-050">{selected.name}</span> ·{" "}
        <Link href="/play/characters/new" className="text-ash-400 underline hover:text-ash-100">
          change campaign
        </Link>
      </p>
      <CreateCharacterForm campaignId={selected.id} />
    </>
  );
}

function Heading() {
  return (
    <div>
      <span className="runic hot">New character</span>
      <h1 className="font-display mt-4 text-2xl font-bold tracking-tight text-ash-050">
        Roll someone up.
      </h1>
    </div>
  );
}

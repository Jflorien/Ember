import { createClient } from "@/lib/supabase/server";
import { getMyPlayerCampaign, getPartyMembers } from "@/app/dm/actions";
import { TvEventFeed } from "@/components/tv-event-feed";
import { RoundBadge } from "@/components/round-badge";
import { TableMap } from "@/components/table-map";
import { PartyStatusStrip } from "@/components/party-status-strip";

// This page always reflects a live session; never attempt static generation.
export const dynamic = "force-dynamic";

export default async function TableViewPage({
  searchParams,
}: {
  searchParams: Promise<{ campaign?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // No visible campaign switcher here on purpose — /table is specified
  // chrome-free ("no input, no hover, no chrome"). ?campaign=<id> still
  // works for deep-linking a specific table from outside the page itself.
  const { campaign: campaignIdParam } = await searchParams;
  const campaign = user ? await getMyPlayerCampaign(campaignIdParam) : null;

  if (!campaign) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-basalt-990 px-6 text-center">
        <span className="runic">Coming soon</span>
        <h1 className="font-display mt-4 max-w-2xl text-3xl font-bold tracking-tight text-ash-050">
          The map everyone watches.
        </h1>
        <p className="mt-4 max-w-lg text-ash-300">
          Spells land, fire spreads, and destruction sticks — this screen is
          built for the TV, chrome-free, so the table can look up instead of
          at a phone.
        </p>
      </main>
    );
  }

  const { sessionId } = campaign;
  const members = await getPartyMembers(campaign.id);

  // A TV is wide and far away. The old single centred column left most of a
  // 16:9 screen empty and pushed the log below the fold; map and log sit side
  // by side now, and the party rail is on-screen because "heat is state" is
  // only worth anything if HP is actually readable from the sofa.
  return (
    <main className="relative flex h-screen flex-col overflow-hidden bg-basalt-990 px-8 py-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,rgba(242,100,25,.16),transparent_70%)] blur-3xl"
      />

      <header className="relative mb-5 flex shrink-0 items-center justify-between gap-6">
        <h1 className="font-display truncate text-3xl font-bold tracking-tight text-ash-050">
          {campaign.name}
        </h1>
        <RoundBadge sessionId={sessionId} />
      </header>

      <div className="relative grid min-h-0 flex-1 grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="flex min-h-0 items-start">
          <TableMap sessionId={sessionId} members={members} />
        </div>

        <div className="flex min-h-0 flex-col gap-6">
          <PartyStatusStrip sessionId={sessionId} members={members} />
          <div className="min-h-0 flex-1 overflow-hidden">
            <TvEventFeed sessionId={sessionId} limit={5} members={members} />
          </div>
        </div>
      </div>
    </main>
  );
}

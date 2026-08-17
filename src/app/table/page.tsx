import { createClient } from "@/lib/supabase/server";
import { getMyPlayerCampaign, getPartyMembers } from "@/app/dm/actions";
import { TvEventFeed } from "@/components/tv-event-feed";
import { RoundBadge } from "@/components/round-badge";
import { TableMap } from "@/components/table-map";

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

  return (
    <main className="relative flex min-h-screen flex-col items-center overflow-hidden bg-basalt-990 px-10 py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,rgba(242,100,25,.16),transparent_70%)] blur-3xl"
      />
      <div className="relative w-full max-w-5xl">
        <div className="mb-6 flex justify-center">
          <RoundBadge sessionId={sessionId} />
        </div>
        <TableMap sessionId={sessionId} members={members} />
        <div className="mt-8">
          <TvEventFeed sessionId={sessionId} limit={4} />
        </div>
      </div>
    </main>
  );
}

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/auth/actions";
import {
  getMyDmCampaign,
  getMyDmCampaigns,
  getPartyMembers,
  getCampaignMembers,
  getSpells,
} from "@/app/dm/actions";
import { CreateCampaignForm } from "@/components/create-campaign-form";
import { InviteCodeDisplay } from "@/components/invite-code-display";
import { CampaignSwitcher } from "@/components/campaign-switcher";
import { LiveEventFeed } from "@/components/live-event-feed";
import { EventConsole } from "@/components/event-console";
import { PartyStatusStrip } from "@/components/party-status-strip";
import { RoundTracker } from "@/components/round-tracker";
import { MemberManagement } from "@/components/member-management";
import { MapControlPanel } from "@/components/map-control-panel";
import { ConsolePanel } from "@/components/console-panel";
import { SeedDemoButton } from "@/components/seed-demo-button";

// This page always reflects a live session; never attempt static generation.
export const dynamic = "force-dynamic";

export default async function DmConsolePage({
  searchParams,
}: {
  searchParams: Promise<{ campaign?: string; new?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { campaign: campaignIdParam, new: isNew } = await searchParams;
  const campaigns = await getMyDmCampaigns();
  const campaign = isNew === "1" ? null : await getMyDmCampaign(campaignIdParam);

  return (
    // Viewport-locked only on xl, where the three rails scroll independently.
    // Below that it's a normal scrolling page with the rails stacked.
    <main className="flex min-h-screen flex-col bg-basalt-950 xl:h-screen xl:min-h-0 xl:overflow-hidden">
      <header className="flex shrink-0 flex-wrap items-center gap-4 border-b border-basalt-700 px-6 py-3">
        <span className="runic hot shrink-0">Ember / DM Console</span>

        {campaigns.length > 0 && (
          <div className="min-w-0 flex-1">
            <CampaignSwitcher
              campaigns={campaigns}
              activeId={campaign?.id ?? ""}
              basePath="/dm"
              newHref="/dm?new=1"
              newLabel="New campaign"
            />
          </div>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-4">
          <Link href="/table" className="text-sm text-ash-400 hover:text-ash-100">
            Table view ↗
          </Link>
          <form action={signOut}>
            <button type="submit" className="text-sm text-ash-400 hover:text-ash-100">
              {user?.email ?? "Log out"} — Sign out
            </button>
          </form>
        </div>
      </header>

      {!campaign ? (
        <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-16">
          <CreateCampaignForm />

          <div className="plate flex flex-col gap-3 p-6">
            <span className="runic">Or start from an example</span>
            <p className="text-sm text-ash-300">
              Builds a fresh campaign — a party of three, a mapped crypt, and a fight already
              in progress — so every surface has something to show. It uses the same tables and
              rules as a table you build by hand; nothing about it is a mock.
            </p>
            <SeedDemoButton />
          </div>
        </div>
      ) : (
        <DmConsoleBody
          campaignId={campaign.id}
          campaignName={campaign.name}
          sessionId={campaign.sessionId}
          inviteCode={campaign.inviteCode}
        />
      )}
    </main>
  );
}

async function DmConsoleBody({
  campaignId,
  campaignName,
  sessionId,
  inviteCode,
}: {
  campaignId: string;
  campaignName: string;
  sessionId: string;
  inviteCode: string;
}) {
  const members = await getPartyMembers(campaignId);
  const campaignMembers = await getCampaignMembers(campaignId);
  const spells = await getSpells();

  return (
    <div className="flex w-full flex-1 flex-col gap-4 p-4 xl:min-h-0">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="font-display text-2xl font-bold tracking-tight text-ash-050">
          {campaignName}
        </h1>
        <span className="font-mono text-xs text-ash-500">
          {members.length} {members.length === 1 ? "character" : "characters"} ·{" "}
          {campaignMembers.length} {campaignMembers.length === 1 ? "player" : "players"} joined
        </span>
      </div>

      {/* Three rails on a wide screen, one stacked column below xl. The map is
          the centre because it's the thing the DM points at; the log is a rail
          because it's read continuously rather than acted on. */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-[19rem_minmax(0,1fr)_23rem]">
        <div className="flex min-h-0 flex-col gap-4 xl:overflow-y-auto">
          <ConsolePanel title="Turn Control">
            <RoundTracker sessionId={sessionId} />
          </ConsolePanel>

          <ConsolePanel title="Party">
            <PartyStatusStrip sessionId={sessionId} members={members} layout="column" />
          </ConsolePanel>

          <ConsolePanel title="Players">
            <div className="flex flex-col gap-4">
              <InviteCodeDisplay campaignId={campaignId} inviteCode={inviteCode} />
              <MemberManagement campaignId={campaignId} members={campaignMembers} />
            </div>
          </ConsolePanel>
        </div>

        <div className="flex min-h-0 flex-col gap-4 xl:overflow-y-auto">
          <ConsolePanel title="Live Table">
            <MapControlPanel sessionId={sessionId} members={members} />
          </ConsolePanel>

          <ConsolePanel title="Event Console">
            <EventConsole sessionId={sessionId} members={members} spells={spells} />
          </ConsolePanel>
        </div>

        <ConsolePanel
          title="Session Log"
          className="min-h-0"
          bodyClassName="overflow-y-auto"
        >
          <LiveEventFeed sessionId={sessionId} members={members} />
        </ConsolePanel>
      </div>
    </div>
  );
}

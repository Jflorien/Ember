import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/auth/actions";
import { getMyDmCampaign, getMyDmCampaigns, getPartyMembers } from "@/app/dm/actions";
import { CreateCampaignForm } from "@/components/create-campaign-form";
import { InviteCodeDisplay } from "@/components/invite-code-display";
import { CampaignSwitcher } from "@/components/campaign-switcher";
import { EventComposer } from "@/components/event-composer";
import { LiveEventFeed } from "@/components/live-event-feed";
import { TargetedComposers } from "@/components/targeted-composers";
import { PartyStatusStrip } from "@/components/party-status-strip";
import { RoundTracker } from "@/components/round-tracker";

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
    <main className="flex min-h-screen flex-col bg-basalt-950">
      <header className="flex items-center justify-between border-b border-basalt-700 px-6 py-4">
        <span className="runic hot">Ember / DM Console</span>
        <form action={signOut}>
          <button type="submit" className="text-sm text-ash-400 hover:text-ash-100">
            {user?.email ?? "Log out"} — Sign out
          </button>
        </form>
      </header>

      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-16">
        {campaigns.length > 0 && (
          <CampaignSwitcher
            campaigns={campaigns}
            activeId={campaign?.id ?? ""}
            basePath="/dm"
            newHref="/dm?new=1"
            newLabel="New campaign"
          />
        )}

        {!campaign ? (
          <CreateCampaignForm />
        ) : (
          <DmConsoleBody campaignId={campaign.id} sessionId={campaign.sessionId} inviteCode={campaign.inviteCode} />
        )}
      </div>
    </main>
  );
}

async function DmConsoleBody({
  campaignId,
  sessionId,
  inviteCode,
}: {
  campaignId: string;
  sessionId: string;
  inviteCode: string;
}) {
  const members = await getPartyMembers(campaignId);

  return (
    <>
      <div>
        <span className="runic hot">Event console — early proof</span>
        <h1 className="font-display mt-4 text-2xl font-bold tracking-tight text-ash-050">
          Propose an event. Watch it commit.
        </h1>
        <p className="mt-2 text-sm text-ash-300">
          Every narration you send here is validated against the same
          zod schema the rules engine will use, committed to{" "}
          <code className="font-mono text-ash-100">events</code>, and
          fanned out over Realtime — this is what{" "}
          <code className="font-mono text-ash-100">/table</code> is
          reading live, in another tab or another browser.
        </p>
      </div>

      <InviteCodeDisplay inviteCode={inviteCode} />

      <RoundTracker sessionId={sessionId} />

      <EventComposer sessionId={sessionId} />

      <div>
        <div className="runic mb-3">Party</div>
        <PartyStatusStrip sessionId={sessionId} members={members} />
      </div>

      <TargetedComposers sessionId={sessionId} members={members} />

      <div>
        <div className="runic mb-3">Session log</div>
        <LiveEventFeed sessionId={sessionId} />
      </div>
    </>
  );
}

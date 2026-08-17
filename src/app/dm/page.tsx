import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/auth/actions";
import {
  getMyDmCampaign,
  getMyDmCampaigns,
  getPartyMembers,
  getCampaignMembers,
} from "@/app/dm/actions";
import { CreateCampaignForm } from "@/components/create-campaign-form";
import { InviteCodeDisplay } from "@/components/invite-code-display";
import { CampaignSwitcher } from "@/components/campaign-switcher";
import { EventComposer } from "@/components/event-composer";
import { LiveEventFeed } from "@/components/live-event-feed";
import { TargetedComposers } from "@/components/targeted-composers";
import { PartyStatusStrip } from "@/components/party-status-strip";
import { RoundTracker } from "@/components/round-tracker";
import { MemberManagement } from "@/components/member-management";
import { MapControlPanel } from "@/components/map-control-panel";

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
          <DmConsoleBody
            campaignId={campaign.id}
            sessionId={campaign.sessionId}
            inviteCode={campaign.inviteCode}
          />
        )}
      </div>
    </main>
  );
}

function PanelSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="runic">{title}</div>
      {children}
    </section>
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
  const campaignMembers = await getCampaignMembers(campaignId);

  return (
    <>
      <div>
        <span className="runic hot">DM console</span>
        <h1 className="font-display mt-4 text-2xl font-bold tracking-tight text-ash-050">
          Propose an event. Watch it commit.
        </h1>
        <p className="mt-2 text-sm text-ash-300">
          Every event proposed here is validated against the same zod schema
          the rules engine uses, committed to{" "}
          <code className="font-mono text-ash-100">events</code>, and fanned
          out over Realtime — this is what{" "}
          <code className="font-mono text-ash-100">/table</code> and{" "}
          <code className="font-mono text-ash-100">/play</code> are reading
          live.
        </p>
      </div>

      <PanelSection title="Session Setup">
        <InviteCodeDisplay campaignId={campaignId} inviteCode={inviteCode} />
        <MemberManagement campaignId={campaignId} members={campaignMembers} />
      </PanelSection>

      <PanelSection title="Turn Control">
        <RoundTracker sessionId={sessionId} />
      </PanelSection>

      <PanelSection title="Party">
        <PartyStatusStrip sessionId={sessionId} members={members} />
      </PanelSection>

      <PanelSection title="Live Table">
        <MapControlPanel sessionId={sessionId} members={members} />
      </PanelSection>

      <PanelSection title="Event Console">
        <EventComposer sessionId={sessionId} members={members} />
        <TargetedComposers sessionId={sessionId} members={members} />
      </PanelSection>

      <PanelSection title="Session Log">
        <LiveEventFeed sessionId={sessionId} />
      </PanelSection>
    </>
  );
}

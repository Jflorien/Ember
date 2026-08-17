import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/auth/actions";
import {
  getMyPlayerCampaign,
  getMyPlayerCampaigns,
  getMyCharacter,
  getPartyMembers,
} from "@/app/dm/actions";
import { JoinCampaignForm } from "@/components/join-campaign-form";
import { CreateCharacterForm } from "@/components/create-character-form";
import { CampaignSwitcher } from "@/components/campaign-switcher";
import { CharacterHp } from "@/components/character-hp";
import { CharacterConditions } from "@/components/character-conditions";
import { PartyStatusStrip } from "@/components/party-status-strip";
import { RoundBadge } from "@/components/round-badge";
import { PlayerActionPanel } from "@/components/player-action-panel";

// This page always reflects a live session; never attempt static generation.
export const dynamic = "force-dynamic";

export default async function PlayerAppPage({
  searchParams,
}: {
  searchParams: Promise<{ campaign?: string; join?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { campaign: campaignIdParam, join: isJoining } = await searchParams;
  const campaigns = await getMyPlayerCampaigns();
  const campaign = isJoining === "1" ? null : await getMyPlayerCampaign(campaignIdParam);

  return (
    <main className="flex min-h-screen flex-col bg-basalt-950">
      <header className="flex items-center justify-between border-b border-basalt-700 px-6 py-4">
        <span className="runic hot">Ember / Player App</span>
        <form action={signOut}>
          <button type="submit" className="text-sm text-ash-400 hover:text-ash-100">
            {user?.email ?? "Log out"} — Sign out
          </button>
        </form>
      </header>

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 px-6 py-16">
        {campaigns.length > 0 && (
          <CampaignSwitcher
            campaigns={campaigns}
            activeId={campaign?.id ?? ""}
            basePath="/play"
            newHref="/play?join=1"
            newLabel="Join another"
          />
        )}

        {!campaign ? (
          <JoinCampaignForm />
        ) : (
          <PlayerSheetBody campaignId={campaign.id} sessionId={campaign.sessionId} />
        )}
      </div>
    </main>
  );
}

async function PlayerSheetBody({
  campaignId,
  sessionId,
}: {
  campaignId: string;
  sessionId: string;
}) {
  const character = await getMyCharacter(campaignId);

  if (!character) {
    return <CreateCharacterForm campaignId={campaignId} />;
  }

  const members = await getPartyMembers(campaignId);

  return (
    <>
      <div>
        <span className="runic hot">Character sheet — early proof</span>
        <h1 className="font-display mt-4 text-2xl font-bold tracking-tight text-ash-050">
          HP that&rsquo;s never stored.
        </h1>
        <p className="mt-2 text-sm text-ash-300">
          This bar isn&rsquo;t a column that got updated — it&rsquo;s
          recomputed from every <code className="font-mono text-ash-100">damage</code> and{" "}
          <code className="font-mono text-ash-100">heal</code> event
          committed for this character, live over Realtime.
        </p>
      </div>

      <RoundBadge sessionId={sessionId} />

      <div className="plate flex flex-col gap-4 p-6">
        <CharacterHp
          sessionId={sessionId}
          characterId={character.characterId}
          maxHp={character.maxHp}
          label="Your character"
        />
        <div>
          <div className="runic mb-2">Conditions</div>
          <CharacterConditions sessionId={sessionId} characterId={character.characterId} />
        </div>
      </div>

      <div>
        <div className="runic mb-3">Party</div>
        <PartyStatusStrip sessionId={sessionId} members={members} />
      </div>

      <div>
        <div className="runic mb-3">Your actions</div>
        <PlayerActionPanel
          sessionId={sessionId}
          characterId={character.characterId}
          members={members}
        />
      </div>
    </>
  );
}

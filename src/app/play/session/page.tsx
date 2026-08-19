import Link from "next/link";
import {
  getMyPlayerCampaign,
  getMyPlayerCampaigns,
  getMyCharacter,
  getPartyMembers,
  getSpells,
} from "@/app/dm/actions";
import { JoinCampaignForm } from "@/components/join-campaign-form";
import { CampaignSwitcher } from "@/components/campaign-switcher";
import { CharacterHp } from "@/components/character-hp";
import { CharacterConditions } from "@/components/character-conditions";
import { PartyStatusStrip } from "@/components/party-status-strip";
import { RoundBadge } from "@/components/round-badge";
import { PlayerActionPanel } from "@/components/player-action-panel";
import { CharacterPortraitUpload } from "@/components/character-portrait-upload";
import { CoreCharacterStats } from "@/components/core-character-stats";

// This page always reflects a live session; never attempt static generation.
export const dynamic = "force-dynamic";

export default async function PlayerSessionPage({
  searchParams,
}: {
  searchParams: Promise<{ campaign?: string; join?: string }>;
}) {
  const { campaign: campaignIdParam, join: isJoining } = await searchParams;
  const campaigns = await getMyPlayerCampaigns();
  const campaign = isJoining === "1" ? null : await getMyPlayerCampaign(campaignIdParam);

  return (
    <>
      {campaigns.length > 0 && (
        <CampaignSwitcher
          campaigns={campaigns}
          activeId={campaign?.id ?? ""}
          basePath="/play/session"
          newHref="/play/session?join=1"
          newLabel="Join another"
        />
      )}

      {!campaign ? (
        <JoinCampaignForm />
      ) : (
        <PlayerSheetBody campaignId={campaign.id} sessionId={campaign.sessionId} />
      )}
    </>
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
    return (
      <div className="plate flex flex-col gap-3 p-6">
        <span className="runic hot">No character yet</span>
        <p className="text-sm text-ash-300">
          You&rsquo;re in this campaign but haven&rsquo;t built a character for it. Character
          creation lives on its own page now.
        </p>
        <Link
          href={`/play/characters/new?campaign=${campaignId}`}
          className="btn btn-forge text-center"
        >
          Create your character
        </Link>
      </div>
    );
  }

  const members = await getPartyMembers(campaignId);
  const spells = await getSpells();

  return (
    <>
      {/* The player's own sheet leads with who they are, not with how the
          engine works — the old headline here explained event sourcing. */}
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display truncate text-2xl font-bold tracking-tight text-ash-050">
            {character.name}
          </h1>
          <p className="truncate font-mono text-xs text-ash-500">
            {character.class ? `${character.class} · ` : ""}Level {character.level}
          </p>
        </div>
        <RoundBadge sessionId={sessionId} />
      </div>

      <div className="plate flex flex-col gap-4 p-6">
        <CharacterPortraitUpload
          characterId={character.characterId}
          currentUrl={character.portraitUrl}
          name={character.name}
        />
        <CharacterHp
          sessionId={sessionId}
          characterId={character.characterId}
          maxHp={character.maxHp}
          label="Hit points"
        />
        <div>
          <div className="runic mb-2">Conditions</div>
          <CharacterConditions sessionId={sessionId} characterId={character.characterId} />
        </div>
      </div>

      <div className="plate p-6">
        <CoreCharacterStats sheet={character.sheet} level={character.level} />
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
          spells={spells}
        />
      </div>
    </>
  );
}

import { PartyMemberTile } from "@/components/party-member-tile";
import type { PartyMember } from "@/app/dm/actions";

/**
 * The BG3-top-bar equivalent from the Notion player-panels doc: a glance
 * at the whole party's HP and conditions without leaving this screen. Read
 * -only, no tap-to-inspect, no turn-order highlight yet (no initiative
 * tracker exists to sync with).
 */
export function PartyStatusStrip({
  sessionId,
  members,
}: {
  sessionId: string;
  members: PartyMember[];
}) {
  if (members.length === 0) {
    return <p className="font-mono text-sm text-ash-500">No characters yet.</p>;
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {members.map((member) => (
        <PartyMemberTile
          key={member.characterId}
          sessionId={sessionId}
          characterId={member.characterId}
          name={member.name}
          maxHp={member.maxHp}
          portraitUrl={member.portraitUrl}
        />
      ))}
    </div>
  );
}

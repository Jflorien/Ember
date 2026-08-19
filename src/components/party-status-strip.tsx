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
  layout = "row",
}: {
  sessionId: string;
  members: PartyMember[];
  /** "column" stacks the tiles for the DM console's left rail; "row" is the phone/TV strip. */
  layout?: "row" | "column";
}) {
  if (members.length === 0) {
    return <p className="font-mono text-sm text-ash-500">No characters yet.</p>;
  }

  return (
    <div
      // Wraps rather than scrolls horizontally: nobody scrolls a TV, and on a
      // phone a second row beats a hidden fourth party member.
      className={
        layout === "column" ? "flex flex-col gap-2" : "flex flex-wrap gap-3"
      }
    >
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

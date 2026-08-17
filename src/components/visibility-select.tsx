import type { PartyMember } from "@/app/dm/actions";

/**
 * Per-event visibility control (DM Console Panels, panel 7: "Per-event
 * visibility control at proposal time: public / dm_only / player:<uuid>").
 * `player:<uuid>` is scoped by owning *user*, not character — a table two
 * players share still needs one option per player, so this reads
 * member.ownerId, not member.characterId.
 */
export function VisibilitySelect({ members }: { members: PartyMember[] }) {
  return (
    <select
      name="visibility"
      defaultValue="public"
      className="bg-basalt-900 px-3 py-2 text-sm text-ash-100 focus:outline-none focus:shadow-[inset_0_0_0_1px_var(--forge-500)]"
    >
      <option value="public">Visible to party</option>
      <option value="dm_only">DM only</option>
      {members.map((member) => (
        <option key={member.characterId} value={`player:${member.ownerId}`}>
          {member.name} only
        </option>
      ))}
    </select>
  );
}

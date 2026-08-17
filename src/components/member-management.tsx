"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  updateMemberRole,
  removeMember,
  type EventActionState,
  type CampaignMember,
} from "@/app/dm/actions";

const initialState: EventActionState = {};

/** Compact inline submit — SubmitButton is hardcoded w-full, wrong for a row of controls. */
function InlineSubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn btn-iron px-3 py-1.5 text-xs">
      {pending ? "…" : children}
    </button>
  );
}

function MemberRow({ campaignId, member }: { campaignId: string; member: CampaignMember }) {
  const roleAction = updateMemberRole.bind(null, campaignId, member.userId);
  const removeAction = removeMember.bind(null, campaignId, member.userId);
  const [roleState, roleFormAction] = useActionState(roleAction, initialState);
  const [removeState, removeFormAction] = useActionState(removeAction, initialState);
  const error = roleState.error ?? removeState.error;

  return (
    <li className="plate flex flex-wrap items-center gap-3 px-4 py-3">
      <span className="flex-1 text-sm text-ash-100">{member.displayName}</span>

      <form action={roleFormAction} className="flex items-center gap-2">
        {/* key={member.role} forces a remount when the prop changes after
            revalidatePath — an uncontrolled select's defaultValue is only
            read on mount, so without this the dropdown would keep showing
            the pre-save role even though the write succeeded. */}
        <select
          key={member.role}
          name="role"
          defaultValue={member.role}
          className="bg-basalt-900 px-2 py-1.5 text-xs text-ash-100 focus:outline-none focus:shadow-[inset_0_0_0_1px_var(--forge-500)]"
        >
          <option value="player">player</option>
          <option value="spectator">spectator</option>
        </select>
        <InlineSubmitButton>Save</InlineSubmitButton>
      </form>

      <form action={removeFormAction}>
        <button
          type="submit"
          className="text-xs font-semibold text-ash-500 hover:text-[#ff8f92]"
        >
          Remove
        </button>
      </form>

      {error && (
        <p className="w-full text-sm text-[#ff8f92]" role="alert">
          {error}
        </p>
      )}
    </li>
  );
}

/** The DM console's roster — kick a member or change player/spectator, backed by memberships RLS. */
export function MemberManagement({
  campaignId,
  members,
}: {
  campaignId: string;
  members: CampaignMember[];
}) {
  if (members.length === 0) {
    return (
      <p className="font-mono text-sm text-ash-500">
        No one has joined yet — share the invite code above.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {members.map((member) => (
        <MemberRow key={member.userId} campaignId={campaignId} member={member} />
      ))}
    </ul>
  );
}

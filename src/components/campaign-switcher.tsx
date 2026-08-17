import Link from "next/link";
import type { CampaignSummary } from "@/app/dm/actions";

/**
 * Plain links, not a client-side dropdown — switching campaigns is page
 * navigation (?campaign=<id>), not in-page state, so a server component
 * that just renders <Link>s is enough. Always shown once at least one
 * campaign exists, even just one, so "+ New" stays discoverable.
 */
export function CampaignSwitcher({
  campaigns,
  activeId,
  basePath,
  newHref,
  newLabel,
}: {
  campaigns: CampaignSummary[];
  activeId: string;
  basePath: string;
  newHref: string;
  newLabel: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {campaigns.map((campaign) => (
        <Link
          key={campaign.id}
          href={`${basePath}?campaign=${campaign.id}`}
          className={
            "plate sm px-3 py-1.5 text-xs font-semibold " +
            (campaign.id === activeId ? "text-forge-300" : "text-ash-400 hover:text-ash-100")
          }
        >
          {campaign.name}
        </Link>
      ))}
      <Link href={newHref} className="text-xs font-semibold text-ash-500 hover:text-forge-400">
        + {newLabel}
      </Link>
    </div>
  );
}

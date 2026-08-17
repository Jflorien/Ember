import { redirect } from "next/navigation";
import Link from "next/link";
import { joinCampaignByCode } from "@/app/dm/actions";

// Always redeems the code fresh; never cache a join attempt.
export const dynamic = "force-dynamic";

export default async function JoinCampaignPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const result = await joinCampaignByCode(code);

  if (result.error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-basalt-950 px-6 text-center">
        <span className="runic hot">Couldn&rsquo;t join</span>
        <h1 className="font-display mt-4 text-2xl font-bold text-ash-050">{result.error}</h1>
        <p className="mt-2 text-sm text-ash-300">
          Double-check the invite code with your DM, or head back to your table.
        </p>
        <Link href="/play" className="btn btn-forge mt-8">
          Go to /play
        </Link>
      </main>
    );
  }

  redirect("/play");
}

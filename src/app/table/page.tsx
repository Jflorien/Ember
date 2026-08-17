import { createClient } from "@/lib/supabase/server";
import { getOrCreateDemoSession } from "@/app/dm/actions";
import { LiveEventFeed } from "@/components/live-event-feed";

// This page always reflects a live session; never attempt static generation.
export const dynamic = "force-dynamic";

export default async function TableViewPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-basalt-990 px-6 text-center">
        <span className="runic">Coming soon</span>
        <h1 className="font-display mt-4 max-w-2xl text-3xl font-bold tracking-tight text-ash-050">
          The map everyone watches.
        </h1>
        <p className="mt-4 max-w-lg text-ash-300">
          Spells land, fire spreads, and destruction sticks — this screen is
          built for the TV, chrome-free, so the table can look up instead of
          at a phone.
        </p>
      </main>
    );
  }

  const { sessionId } = await getOrCreateDemoSession();

  return (
    <main className="flex min-h-screen flex-col items-center bg-basalt-990 px-6 py-16">
      <div className="w-full max-w-2xl">
        <span className="runic">Live — early proof</span>
        <h1 className="font-display mt-4 text-2xl font-bold tracking-tight text-ash-050">
          Reading straight from Realtime.
        </h1>
        <p className="mt-2 text-sm text-ash-300">
          Nothing on this page is polled. Every row below arrived the
          moment a DM console committed it.
        </p>
        <div className="mt-8">
          <LiveEventFeed sessionId={sessionId} />
        </div>
      </div>
    </main>
  );
}

import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/auth/actions";

// This page always reflects a live session; never attempt static generation.
export const dynamic = "force-dynamic";

export default async function DmConsolePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

      <div className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
        <span className="runic hot">Coming soon</span>
        <h1 className="font-display mt-4 max-w-xl text-3xl font-bold tracking-tight text-ash-050">
          Narrative control, initiative, hidden stats, and undo.
        </h1>
        <p className="mt-4 max-w-lg text-ash-300">
          This is where the DM proposes events — narration, rolls, damage,
          and scene changes — and watches the rules engine validate and
          commit them to the shared session state in real time.
        </p>
      </div>
    </main>
  );
}

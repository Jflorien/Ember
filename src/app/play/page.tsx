import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/auth/actions";
import { getOrCreateDemoSession, getOrCreateDemoCharacter } from "@/app/dm/actions";
import { CharacterHp } from "@/components/character-hp";

// This page always reflects a live session; never attempt static generation.
export const dynamic = "force-dynamic";

export default async function PlayerAppPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { campaignId, sessionId } = await getOrCreateDemoSession();
  const { characterId, maxHp } = await getOrCreateDemoCharacter(campaignId);

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

        <div className="plate p-6">
          <CharacterHp
            sessionId={sessionId}
            characterId={characterId}
            maxHp={maxHp}
            label="Demo character"
          />
        </div>
      </div>
    </main>
  );
}

import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/auth/actions";
import { getOrCreateDemoSession, getOrCreateDemoCharacter } from "@/app/dm/actions";
import { EventComposer } from "@/components/event-composer";
import { LiveEventFeed } from "@/components/live-event-feed";
import { DamageHealComposer } from "@/components/damage-heal-composer";
import { CharacterHp } from "@/components/character-hp";
import { ConditionComposer } from "@/components/condition-composer";
import { CharacterConditions } from "@/components/character-conditions";

// This page always reflects a live session; never attempt static generation.
export const dynamic = "force-dynamic";

export default async function DmConsolePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { campaignId, sessionId } = await getOrCreateDemoSession();
  const { characterId, maxHp } = await getOrCreateDemoCharacter(campaignId);

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

      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-16">
        <div>
          <span className="runic hot">Event console — early proof</span>
          <h1 className="font-display mt-4 text-2xl font-bold tracking-tight text-ash-050">
            Propose an event. Watch it commit.
          </h1>
          <p className="mt-2 text-sm text-ash-300">
            Every narration you send here is validated against the same
            zod schema the rules engine will use, committed to{" "}
            <code className="font-mono text-ash-100">events</code>, and
            fanned out over Realtime — this is what{" "}
            <code className="font-mono text-ash-100">/table</code> is
            reading live, in another tab or another browser.
          </p>
        </div>

        <EventComposer sessionId={sessionId} />

        <div>
          <div className="runic mb-3">Demo character</div>
          <CharacterHp sessionId={sessionId} characterId={characterId} maxHp={maxHp} />
          <div className="mt-3">
            <CharacterConditions sessionId={sessionId} characterId={characterId} />
          </div>
        </div>

        <DamageHealComposer sessionId={sessionId} targetId={characterId} />
        <ConditionComposer sessionId={sessionId} targetId={characterId} />

        <div>
          <div className="runic mb-3">Session log</div>
          <LiveEventFeed sessionId={sessionId} />
        </div>
      </div>
    </main>
  );
}

import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/auth/actions";
import { PlayerNav } from "@/components/player-nav";

/**
 * The player app is a dashboard, not one page: header + tab bar are shared,
 * each tab owns its own route. `/play/session` is the only one that's a live
 * session view; the rest are meta panels (Player Meta Panels, Notion).
 */
export default async function PlayerLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

      <div className="mx-auto w-full max-w-md px-6">
        <PlayerNav />
      </div>

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 px-6 py-10">
        {children}
      </div>
    </main>
  );
}

import Link from "next/link";

export function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-basalt-700 bg-basalt-950/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link
          href="/"
          className="font-display text-sm font-bold uppercase tracking-[0.34em] text-forge-500"
        >
          Ember
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          <Link
            href="#the-game"
            className="text-sm text-ash-400 transition-colors hover:text-ash-050"
          >
            The game
          </Link>
          <Link
            href="#three-screens"
            className="text-sm text-ash-400 transition-colors hover:text-ash-050"
          >
            Three screens
          </Link>
          <Link
            href="#how-it-works"
            className="text-sm text-ash-400 transition-colors hover:text-ash-050"
          >
            How it works
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="btn btn-ghost hidden sm:inline-flex"
          >
            Log in
          </Link>
          <Link href="/signup" className="btn btn-forge">
            Get early access
          </Link>
        </div>
      </div>
    </header>
  );
}

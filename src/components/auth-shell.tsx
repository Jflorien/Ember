import Link from "next/link";
import type { ReactNode } from "react";

const FLAVOR_LINES = [
  "“The room goes white. When it comes back, the goblins are scattered like kicked coals and the crates are burning where they stand.”",
  "“We rolled initiative in the elevator. The map was already up by the time we sat down.”",
  "“Three screens, one table, and nobody arguing about what actually happened.”",
];

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  const flavor = FLAVOR_LINES[0];

  return (
    <div className="flex min-h-screen">
      <div className="flex w-full flex-col justify-center px-6 py-16 lg:w-1/2">
        <div className="mx-auto w-full max-w-[420px]">
          <Link
            href="/"
            className="font-display text-sm font-bold uppercase tracking-[0.34em] text-forge-500"
          >
            Ember
          </Link>

          <h1 className="font-display mt-8 text-2xl font-bold tracking-tight text-ash-050">
            {title}
          </h1>
          <p className="mt-2 text-sm text-ash-300">{subtitle}</p>

          <div className="mt-8">{children}</div>
        </div>
      </div>

      <div className="relative hidden overflow-hidden border-l border-basalt-700 bg-[linear-gradient(160deg,var(--basalt-900),var(--basalt-990))] lg:flex lg:w-1/2">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 right-0 h-[30rem] w-[30rem] rounded-full bg-[radial-gradient(circle_at_center,rgba(242,100,25,.32),transparent_70%)] blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-0 left-0 h-96 w-96 rounded-full bg-[radial-gradient(circle_at_center,rgba(94,200,232,.22),transparent_70%)] blur-3xl"
        />
        <div className="relative flex flex-1 flex-col justify-end p-16">
          <p className="font-display max-w-md text-2xl font-bold leading-snug text-ash-100">
            {flavor}
          </p>
          <p className="runic mt-4">A table, somewhere, last Tuesday</p>
        </div>
      </div>
    </div>
  );
}

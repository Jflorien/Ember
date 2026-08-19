"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/play", label: "Home", exact: true },
  { href: "/play/session", label: "Current game" },
  { href: "/play/characters", label: "Characters" },
  { href: "/play/account", label: "Account" },
] as const;

/**
 * The player app's top-level division. Deliberately *not* forge/gold on the
 * active tab — the design system reserves gold for "it is your turn," and a
 * nav tab is never that. Molten is the accent here, paired with a border and
 * a brighter label so the active state survives without relying on colour
 * alone.
 */
export function PlayerNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-basalt-700">
      {TABS.map((tab) => {
        const active =
          "exact" in tab && tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={
              "shrink-0 border-b-2 px-4 py-3 text-sm transition-colors " +
              (active
                ? "border-b-molten-500 font-semibold text-ash-050"
                : "border-b-transparent text-ash-400 hover:text-ash-100")
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

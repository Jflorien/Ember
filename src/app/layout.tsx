import type { Metadata } from "next";
import "./globals.css";

// NOTE: next/font/google (Cinzel, Inter, JetBrains Mono) was attempted here,
// wired to --f-display / --f-ui / --f-mono, but the build environment has no
// network access to fonts.googleapis.com (proxy policy returns 403 on
// CONNECT). We fall back to the system font stacks already defined as the
// tails of those CSS variables in globals.css, matching design-system.html's
// own fallback stance ("the system works on system fonts").
export const metadata: Metadata = {
  title: "Ember — you don't need a dungeon master",
  description:
    "Ember is an AI dungeon master that builds the world, runs the rules, and reacts to whatever your party actually does — solo, or with friends, any night you feel like playing.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col bg-basalt-950 text-ash-100 antialiased">
        {children}
      </body>
    </html>
  );
}

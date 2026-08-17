"use client";

import { useSessionTerrain } from "@/lib/hooks/use-session-terrain";
import { useCharacterPositions } from "@/lib/hooks/use-character-positions";
import { MapGrid } from "@/components/map-grid";
import type { PartyMember } from "@/app/dm/actions";

/** Read-only wrapper around MapGrid for /table — terrain and tokens only, no input. */
export function TableMap({ sessionId, members }: { sessionId: string; members: PartyMember[] }) {
  const terrain = useSessionTerrain(sessionId);
  const positions = useCharacterPositions(sessionId);

  return <MapGrid terrain={terrain} positions={positions} members={members} />;
}

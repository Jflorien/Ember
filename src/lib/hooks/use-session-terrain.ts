"use client";

import { useMemo } from "react";
import { useSessionEvents } from "./use-session-events";

export type TerrainType = "difficult" | "wall" | "hazard" | "prop";
export type TerrainCell = { terrainType: TerrainType; destructible: boolean };

/**
 * Map state is never stored — same fold pattern as HP/conditions/round.
 * Last `terrain` event for a cell wins; a `destroy` event clears it back
 * to open ground (the trigger — proposeDestroyEvent — only ever commits
 * one against a cell that's currently marked destructible, checked
 * server-side, so this fold doesn't need to re-check that itself).
 */
export function useSessionTerrain(sessionId: string): Map<string, TerrainCell> {
  const events = useSessionEvents(sessionId);

  return useMemo(() => {
    const cells = new Map<string, TerrainCell>();
    for (const event of events) {
      if (event.type === "terrain") {
        const payload = event.payload as {
          cell?: { x: number; y: number };
          terrainType?: string;
          destructible?: boolean;
        };
        if (!payload.cell) continue;
        cells.set(`${payload.cell.x},${payload.cell.y}`, {
          terrainType: (payload.terrainType as TerrainType) ?? "wall",
          destructible: Boolean(payload.destructible),
        });
      } else if (event.type === "destroy") {
        const payload = event.payload as { cell?: { x: number; y: number } };
        if (!payload.cell) continue;
        cells.delete(`${payload.cell.x},${payload.cell.y}`);
      }
    }
    return cells;
  }, [events]);
}

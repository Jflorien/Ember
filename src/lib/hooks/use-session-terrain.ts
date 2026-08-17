"use client";

import { useMemo } from "react";
import { useSessionEvents } from "./use-session-events";

export type TerrainType = "difficult" | "wall" | "hazard" | "prop";
export type TerrainCell = { terrainType: TerrainType; destructible: boolean };

/**
 * Map state is never stored — same fold pattern as HP/conditions/round.
 * Last `terrain` event for a cell wins; there's no "clear" yet, so a
 * placed cell stays until a future event type adds one.
 */
export function useSessionTerrain(sessionId: string): Map<string, TerrainCell> {
  const events = useSessionEvents(sessionId);

  return useMemo(() => {
    const cells = new Map<string, TerrainCell>();
    for (const event of events) {
      if (event.type !== "terrain") continue;
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
    }
    return cells;
  }, [events]);
}

"use client";

import { useState, useActionState } from "react";
import {
  proposePlaceTerrainEvent,
  proposeMoveEvent,
  type EventActionState,
  type PartyMember,
} from "@/app/dm/actions";
import { useSessionTerrain, type TerrainType } from "@/lib/hooks/use-session-terrain";
import { useCharacterPositions } from "@/lib/hooks/use-character-positions";
import { MapGrid } from "@/components/map-grid";

const initialState: EventActionState = {};
const TERRAIN_TYPES: TerrainType[] = ["wall", "difficult", "hazard", "prop"];

/**
 * DM Console Panels §4, "Live Table / Map Control" — the DM's real-time
 * authority over the shared map. Two modes on one grid: click to place
 * terrain, or click to move the selected character. Map state is never
 * stored — MapGrid renders the same terrain/position folds /table reads.
 */
export function MapControlPanel({
  sessionId,
  members,
}: {
  sessionId: string;
  members: PartyMember[];
}) {
  const terrain = useSessionTerrain(sessionId);
  const positions = useCharacterPositions(sessionId);

  const [mode, setMode] = useState<"move" | "terrain">("move");
  const [terrainType, setTerrainType] = useState<TerrainType>("wall");
  const [actorId, setActorId] = useState(members[0]?.characterId ?? "");

  const terrainAction = proposePlaceTerrainEvent.bind(null, sessionId);
  const [terrainState, terrainFormAction] = useActionState(terrainAction, initialState);
  const moveAction = proposeMoveEvent.bind(null, sessionId, actorId);
  const [moveState, moveFormAction] = useActionState(moveAction, initialState);

  function handleCellClick(x: number, y: number) {
    const formData = new FormData();
    formData.set("x", String(x));
    formData.set("y", String(y));
    if (mode === "terrain") {
      formData.set("terrainType", terrainType);
      formData.set("destructible", terrainType === "prop" ? "true" : "false");
      terrainFormAction(formData);
    } else {
      moveFormAction(formData);
    }
  }

  if (members.length === 0) {
    return (
      <p className="font-mono text-sm text-ash-500">
        No characters in this campaign yet to place on the map.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setMode("move")}
            className={
              "px-3 py-1.5 text-xs font-semibold " +
              (mode === "move" ? "btn btn-forge" : "btn btn-iron")
            }
          >
            Move
          </button>
          <button
            type="button"
            onClick={() => setMode("terrain")}
            className={
              "px-3 py-1.5 text-xs font-semibold " +
              (mode === "terrain" ? "btn btn-forge" : "btn btn-iron")
            }
          >
            Terrain
          </button>
        </div>

        {mode === "move" ? (
          <select
            value={actorId}
            onChange={(event) => setActorId(event.target.value)}
            className="bg-basalt-900 px-3 py-1.5 text-sm text-ash-100 focus:outline-none focus:shadow-[inset_0_0_0_1px_var(--forge-500)]"
          >
            {members.map((member) => (
              <option key={member.characterId} value={member.characterId}>
                {member.name}
              </option>
            ))}
          </select>
        ) : (
          <select
            value={terrainType}
            onChange={(event) => setTerrainType(event.target.value as TerrainType)}
            className="bg-basalt-900 px-3 py-1.5 text-sm text-ash-100 focus:outline-none focus:shadow-[inset_0_0_0_1px_var(--forge-500)]"
          >
            {TERRAIN_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        )}

        <span className="text-xs text-ash-500">
          {mode === "move" ? "Click a cell to move the selected character." : "Click a cell to place terrain."}
        </span>
      </div>

      <MapGrid
        terrain={terrain}
        positions={positions}
        members={members}
        onCellClick={handleCellClick}
        interactive
      />

      {(terrainState.error || moveState.error) && (
        <p className="text-sm text-[#ff8f92]" role="alert">
          {terrainState.error || moveState.error}
        </p>
      )}
    </div>
  );
}

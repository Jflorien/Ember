import { GRID_COLS, GRID_ROWS } from "@/lib/grid";
import type { TerrainCell, TerrainType } from "@/lib/hooks/use-session-terrain";
import type { PartyMember } from "@/app/dm/actions";

const TERRAIN_STYLE: Record<TerrainType, { bg: string; glyph: string }> = {
  wall: { bg: "bg-iron-700", glyph: "▓" },
  difficult: { bg: "bg-basalt-600", glyph: "~" },
  hazard: { bg: "bg-molten-800", glyph: "!" },
  prop: { bg: "bg-basalt-750", glyph: "◆" },
};

/**
 * The map primitive — /table's "terrain and tokens only" (In-Session Player
 * Dashboard Panels' note on why /play never renders this). Read-only there;
 * `onCellClick` + `interactive` turn it into the DM's grid editor. Terrain
 * glyph is never color-alone — every cell pairs a background with a
 * character, matching the design system's "never rely on colour alone."
 */
export function MapGrid({
  terrain,
  positions,
  members,
  onCellClick,
  interactive = false,
  size = "console",
}: {
  terrain: Map<string, TerrainCell>;
  positions: Map<string, { x: number; y: number }>;
  members: PartyMember[];
  onCellClick?: (x: number, y: number) => void;
  interactive?: boolean;
  /** "table" is the TV: read at four metres, so glyphs and tokens step up. */
  size?: "console" | "table";
}) {
  const glyphSize = size === "table" ? "text-2xl" : "text-xs";
  const tokenSize = size === "table" ? "text-lg" : "text-[11px]";
  const memberByCharacterId = new Map(members.map((member) => [member.characterId, member]));
  const tokensByCell = new Map<string, PartyMember[]>();
  for (const [characterId, pos] of positions) {
    const member = memberByCharacterId.get(characterId);
    if (!member) continue;
    const key = `${pos.x},${pos.y}`;
    const list = tokensByCell.get(key) ?? [];
    list.push(member);
    tokensByCell.set(key, list);
  }

  const cells = [];
  for (let y = 0; y < GRID_ROWS; y++) {
    for (let x = 0; x < GRID_COLS; x++) {
      const key = `${x},${y}`;
      const cellTerrain = terrain.get(key);
      const tokens = tokensByCell.get(key);
      const style = cellTerrain ? TERRAIN_STYLE[cellTerrain.terrainType] : null;

      cells.push(
        <button
          key={key}
          type="button"
          disabled={!interactive}
          onClick={() => onCellClick?.(x, y)}
          title={cellTerrain ? cellTerrain.terrainType : undefined}
          className={
            "relative aspect-square border border-basalt-800 " +
            (style ? style.bg : "bg-basalt-900") +
            (interactive
              ? " cursor-pointer hover:shadow-[inset_0_0_0_1px_var(--forge-500)]"
              : "")
          }
        >
          {style && (
            <span
              className={
                "pointer-events-none absolute inset-0 flex items-center justify-center text-ash-300 " +
                glyphSize
              }
            >
              {style.glyph}
            </span>
          )}
          {tokens && tokens.length > 0 && (
            <span
              className={
                "pointer-events-none absolute inset-0 flex items-center justify-center font-bold text-forge-200 [text-shadow:0_0_6px_rgba(0,0,0,.9)] " +
                tokenSize
              }
            >
              {tokens.map((token) => token.name[0]?.toUpperCase()).join("")}
            </span>
          )}
        </button>,
      );
    }
  }

  return (
    // Gridlines are basalt-700, not -800: against basalt-900 cells the old
    // pairing was so close in luminance the grid read as a flat dark slab,
    // which defeats the point of a map you're supposed to count squares on.
    <div
      className="grid w-full gap-px bg-basalt-700"
      style={{ gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))` }}
    >
      {cells}
    </div>
  );
}

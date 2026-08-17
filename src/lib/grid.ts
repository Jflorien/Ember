export const GRID_COLS = 16;
export const GRID_ROWS = 10;
export const FEET_PER_CELL = 5;

export type Cell = { x: number; y: number };

/** Chessboard distance — one cell of diagonal movement costs the same as one orthogonal cell, the common simplified 5e variant. */
export function cellDistance(a: Cell, b: Cell): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

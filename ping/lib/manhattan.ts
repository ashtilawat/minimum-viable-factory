export type Cell = { r: number; c: number };

/** Manhattan distance between two grid cells. */
export function manhattan(a: Cell, b: Cell): number {
  return Math.abs(a.r - b.r) + Math.abs(a.c - b.c);
}

export const GRID_SIZE = 12;

export function isOnGrid(r: number, c: number): boolean {
  return r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE;
}

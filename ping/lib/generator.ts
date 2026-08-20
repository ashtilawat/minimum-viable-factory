import { Cell, GRID_SIZE, manhattan } from "./manhattan";

const CORNERS: Cell[] = [
  { r: 0, c: 0 },
  { r: 0, c: 11 },
  { r: 11, c: 0 },
  { r: 11, c: 11 },
];

/** Three fixed corner tap cells — a shared triple means two hidden cells read identically here. */
const TRIPLE_TAPS: Cell[] = [
  { r: 0, c: 0 },
  { r: 0, c: 11 },
  { r: 11, c: 11 },
];

const FORBIDDEN_CENTER: Cell[] = [
  { r: 5, c: 5 },
  { r: 5, c: 6 },
  { r: 6, c: 5 },
  { r: 6, c: 6 },
];

function centerDistance(h: Cell): number {
  return Math.abs(h.r - 5.5) + Math.abs(h.c - 5.5);
}

function isForbiddenCenter(h: Cell): boolean {
  return FORBIDDEN_CENTER.some((f) => f.r === h.r && f.c === h.c);
}

function cornersTooFar(h: Cell): boolean {
  return CORNERS.some((corner) => manhattan(h, corner) >= 18);
}

function centerTooClose(h: Cell): boolean {
  return centerDistance(h) <= 2;
}

/** Two hidden cells share a 3-tap distance triple at the canonical corner taps. */
export function sharesThreeTapTriple(h: Cell, other: Cell): boolean {
  return TRIPLE_TAPS.every((tap) => manhattan(h, tap) === manhattan(other, tap));
}

function hasAmbiguousTriple(h: Cell): boolean {
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (r === h.r && c === h.c) continue;
      if (sharesThreeTapTriple(h, { r, c })) return true;
    }
  }
  return false;
}

export type RejectReason =
  | "center_forbidden"
  | "center_too_close"
  | "corner_too_far"
  | "ambiguous_triple"
  | "same_as_previous"
  | "coords_leak";

/** Returns null if publishable; otherwise the rejection reason. */
export function validateHidden(
  h: Cell,
  previousH?: Cell | null,
): RejectReason | null {
  if (isForbiddenCenter(h)) return "center_forbidden";
  if (centerTooClose(h)) return "center_too_close";
  if (cornersTooFar(h)) return "corner_too_far";
  if (previousH && h.r === previousH.r && h.c === previousH.c) {
    return "same_as_previous";
  }
  if (hasAmbiguousTriple(h)) return "ambiguous_triple";
  if (wouldLeakCoords(h)) return "coords_leak";
  return null;
}

/** Share/title/URL must never encode row/col or H. */
export function wouldLeakCoords(h: Cell): boolean {
  const title = `PING #1`;
  const shareSample = `PING #1 4/4\n📡${manhattan(h, { r: 0, c: 0 })}`;
  const coordPatterns = [
    `${h.r},${h.c}`,
    `${h.r}-${h.c}`,
    `row=${h.r}`,
    `col=${h.c}`,
  ];
  const blob = `${title}\n${shareSample}\n/`;
  return coordPatterns.some((p) => blob.includes(p));
}

export function isPublishable(h: Cell, previousH?: Cell | null): boolean {
  return validateHidden(h, previousH) === null;
}

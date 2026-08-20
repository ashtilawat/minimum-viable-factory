import { Cell } from "./manhattan";
import { PING_EPOCH_UTC } from "./epoch";
import { isPublishable } from "./generator";

/** Deterministic 32-bit hash of a UTC date string. */
function hashDate(utcDate: string): number {
  let h = 2166136261;
  for (let i = 0; i < utcDate.length; i++) {
    h ^= utcDate.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function cellFromHash(seed: number, attempt: number): Cell {
  const mixed = (seed + Math.imul(attempt, 2654435761)) >>> 0;
  return {
    r: mixed % 12,
    c: Math.floor(mixed / 12) % 12,
  };
}

/** Previous UTC calendar day (YYYY-MM-DD). */
export function previousUtcDate(utcDate: string): string {
  const d = new Date(`${utcDate}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Hidden cell H for a UTC calendar date — pure function of the date.
 * Walks deterministic candidates until one passes publishability checks.
 */
export function hiddenForDate(utcDate: string): Cell {
  const seed = hashDate(utcDate);
  let prevH: Cell | null = null;
  const prevDate = previousUtcDate(utcDate);
  if (prevDate >= PING_EPOCH_UTC) {
    prevH = hiddenForDate(prevDate);
  }

  for (let attempt = 0; attempt < 144; attempt++) {
    const candidate = cellFromHash(seed, attempt);
    if (isPublishable(candidate, prevH)) {
      return candidate;
    }
  }

  throw new Error(`No publishable H for ${utcDate}`);
}

/** G1 fixture — forced scoring test only; generator rejects publishing center H. */
export const G1_FIXTURE_H: Cell = { r: 5, c: 5 };

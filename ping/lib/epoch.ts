/**
 * PING_EPOCH_UTC — first publishable puzzle day (UTC calendar date).
 * Puzzle #1 corresponds to this date; #n is the n-th UTC day on or after the epoch.
 */
export const PING_EPOCH_UTC = "2026-01-01";

/** UTC calendar date string (YYYY-MM-DD) for a Date interpreted in UTC. */
export function utcDateString(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** 1-based puzzle number for a UTC calendar date. */
export function puzzleNumber(utcDate: string): number {
  const epochMs = Date.parse(`${PING_EPOCH_UTC}T00:00:00.000Z`);
  const dayMs = Date.parse(`${utcDate}T00:00:00.000Z`);
  const diffDays = Math.round((dayMs - epochMs) / 86_400_000);
  return diffDays + 1;
}

/** UTC calendar date for the current moment. */
export function todayUtcDate(): string {
  return utcDateString(new Date());
}

/** UTC calendar date for a specific instant (handles timezone boundaries). */
export function utcDateForInstant(instant: Date): string {
  return utcDateString(instant);
}

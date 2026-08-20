import { puzzleNumber } from "./epoch";

export type TapResult = { r: number; c: number; d: number };

/**
 * Build share text. Never includes H, coords, or 📡0 on miss lines.
 * Win:  PING #n k/4 + miss 📡 lines + 🎯
 * Lose: PING #n X/4 + exactly four 📡 lines
 */
export function buildShareText(
  utcDate: string,
  taps: TapResult[],
  won: boolean,
): string {
  const n = puzzleNumber(utcDate);
  const misses = taps.filter((t) => t.d !== 0);

  if (won) {
    const k = taps.length;
    const lines = [`PING #${n} ${k}/4`];
    for (const t of misses) {
      lines.push(`📡${t.d}`);
    }
    lines.push("🎯");
    return lines.join("\n");
  }

  const lines = [`PING #${n} X/4`];
  for (const t of taps.slice(0, 4)) {
    lines.push(`📡${t.d}`);
  }
  return lines.join("\n");
}

export function shareTitle(utcDate: string): string {
  return `PING #${puzzleNumber(utcDate)}`;
}

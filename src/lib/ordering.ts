import { generateKeyBetween } from "fractional-indexing";

export function getInitialPosition(): string {
  return generateKeyBetween(null, null);
}

export function getPositionBetween(before: string | null, after: string | null): string {
  return generateKeyBetween(before, after);
}

export function getPositionAfter(last: string | null): string {
  return generateKeyBetween(last, null);
}

export function getPositionBefore(first: string | null): string {
  return generateKeyBetween(null, first);
}

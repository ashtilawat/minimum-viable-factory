import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind CSS class names without conflicts.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Compute the midpoint position for fractional ordering.
 *
 * - Both null  → first ever item: 1.0
 * - a is null  → insert before b (at start): b / 2
 * - b is null  → insert after a (at end): a + 1.0
 * - Otherwise  → insert between a and b: (a + b) / 2
 */
export function midpoint(a: number | null, b: number | null): number {
  if (a === null && b === null) return 1.0;
  if (a === null) return b! / 2;
  if (b === null) return a! + 1.0;
  return (a! + b!) / 2;
}

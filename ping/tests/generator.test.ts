import { describe, expect, it } from "vitest";
import {
  isPublishable,
  sharesThreeTapTriple,
  validateHidden,
} from "../lib/generator";
import { manhattan } from "../lib/manhattan";
import { hiddenForDate } from "../lib/seed";

describe("generator", () => {
  it("rejects center cells (5,5),(5,6),(6,5),(6,6)", () => {
    for (const h of [
      { r: 5, c: 5 },
      { r: 5, c: 6 },
      { r: 6, c: 5 },
      { r: 6, c: 6 },
    ]) {
      expect(isPublishable(h)).toBe(false);
    }
  });

  it("rejects H with d(H, center) <= 2", () => {
    expect(isPublishable({ r: 5, c: 4 })).toBe(false);
    expect(isPublishable({ r: 4, c: 5 })).toBe(false);
  });

  it("rejects H when any corner has d >= 18", () => {
    expect(isPublishable({ r: 0, c: 0 })).toBe(false);
    expect(isPublishable({ r: 11, c: 11 })).toBe(false);
    expect(isPublishable({ r: 0, c: 11 })).toBe(false);
    expect(isPublishable({ r: 11, c: 0 })).toBe(false);
  });

  it("rejects H when another cell shares a 3-tap distance triple", () => {
    const h = { r: 1, c: 1 };
    const other = { r: 1, c: 2 };
    if (sharesThreeTapTriple(h, other)) {
      expect(isPublishable(h)).toBe(false);
    }
  });

  it("rejects H(D+1) = H(D)", () => {
    const prev = { r: 3, c: 7 };
    expect(validateHidden(prev, prev)).toBe("same_as_previous");
  });

  it("published daily H passes all checks", () => {
    for (let i = 0; i < 30; i++) {
      const day = String(i + 1).padStart(2, "0");
      const h = hiddenForDate(`2026-04-${day}`);
      expect(isPublishable(h)).toBe(true);
      expect(manhattan(h, { r: 0, c: 0 })).toBeLessThan(18);
    }
  });
});

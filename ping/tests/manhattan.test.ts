import { describe, expect, it } from "vitest";
import { manhattan } from "../lib/manhattan";

describe("manhattan", () => {
  it("d((5,5),(5,7)) === 2", () => {
    expect(manhattan({ r: 5, c: 5 }, { r: 5, c: 7 })).toBe(2);
  });

  it("d((2,2),(4,5)) === 5", () => {
    expect(manhattan({ r: 2, c: 2 }, { r: 4, c: 5 })).toBe(5);
  });

  it("is Manhattan, not Euclidean or Chebyshev", () => {
    const a = { r: 2, c: 2 };
    const b = { r: 4, c: 5 };
    const d = manhattan(a, b);
    expect(d).toBe(5);
    expect(d).not.toBeCloseTo(3.6);
    expect(d).not.toBe(3);
  });
});

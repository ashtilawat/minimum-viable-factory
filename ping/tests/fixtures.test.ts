import { describe, expect, it } from "vitest";
import { applyTap, initialState, MAX_TAPS } from "../lib/game";
import { G1_FIXTURE_H } from "../lib/seed";
import { manhattan } from "../lib/manhattan";
import { buildShareText } from "../lib/share";

describe("fixtures", () => {
  describe("G1 scoring with H=(5,5)", () => {
    const hidden = G1_FIXTURE_H;

    it("tap (5,7) returns d=2", () => {
      expect(manhattan({ r: 5, c: 7 }, hidden)).toBe(2);
    });

    it("win share for G1", () => {
      const taps = [
        { r: 5, c: 7, d: 2 },
        { r: 5, c: 5, d: 0 },
      ];
      const text = buildShareText("2026-01-05", taps, true);
      expect(text).toBe("PING #5 2/4\n📡2\n🎯");
    });

    it("lose share for G1", () => {
      const taps = [
        { r: 0, c: 0, d: manhattan({ r: 0, c: 0 }, hidden) },
        { r: 0, c: 1, d: manhattan({ r: 0, c: 1 }, hidden) },
        { r: 0, c: 2, d: manhattan({ r: 0, c: 2 }, hidden) },
        { r: 0, c: 3, d: manhattan({ r: 0, c: 3 }, hidden) },
      ];
      const text = buildShareText("2026-01-05", taps, false);
      const lines = text.split("\n");
      expect(lines[0]).toBe("PING #5 X/4");
      expect(lines).toHaveLength(5);
      expect(lines.slice(1).every((l) => l.startsWith("📡"))).toBe(true);
      expect(text).not.toContain("🎯");
    });
  });

  it("retap does not consume a tap", () => {
    let state = initialState({ r: 8, c: 8 });
    state = applyTap(state, 1, 1);
    expect(state.taps).toHaveLength(1);
    state = applyTap(state, 1, 1);
    expect(state.taps).toHaveLength(1);
  });

  it("off-grid tap does not consume a tap", () => {
    let state = initialState({ r: 8, c: 8 });
    state = applyTap(state, -1, 0);
    state = applyTap(state, 12, 0);
    state = applyTap(state, 0, 12);
    expect(state.taps).toHaveLength(0);
  });

  it(`game ends after ${MAX_TAPS} misses`, () => {
    let state = initialState({ r: 10, c: 10 });
    state = applyTap(state, 0, 0);
    state = applyTap(state, 0, 1);
    state = applyTap(state, 0, 2);
    expect(state.locked).toBe(false);
    state = applyTap(state, 0, 3);
    expect(state.locked).toBe(true);
    expect(state.won).toBe(false);
    expect(state.taps).toHaveLength(4);
  });
});

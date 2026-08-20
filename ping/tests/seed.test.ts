import { describe, expect, it } from "vitest";
import { utcDateForInstant, puzzleNumber } from "../lib/epoch";
import { hiddenForDate, G1_FIXTURE_H } from "../lib/seed";
import { isPublishable, validateHidden } from "../lib/generator";

describe("seed", () => {
  it("UTC day boundary: 2026-08-20 19:00 America/Chicago → 2026-08-21", () => {
    const chicago = new Date("2026-08-20T19:00:00-05:00");
    expect(utcDateForInstant(chicago)).toBe("2026-08-21");
    const h20 = hiddenForDate("2026-08-20");
    const h21 = hiddenForDate("2026-08-21");
    expect(h21).not.toEqual(h20);
  });

  it("puzzle number is 1-based from PING_EPOCH_UTC", () => {
    expect(puzzleNumber("2026-01-01")).toBe(1);
    expect(puzzleNumber("2026-01-02")).toBe(2);
  });

  it("hiddenForDate is deterministic", () => {
    expect(hiddenForDate("2026-03-15")).toEqual(hiddenForDate("2026-03-15"));
  });

  it("G1 fixture H=(5,5) is rejected by generator", () => {
    expect(isPublishable(G1_FIXTURE_H)).toBe(false);
    expect(validateHidden(G1_FIXTURE_H)).toBe("center_forbidden");
  });

  it("consecutive days have different H", () => {
    const d1 = "2026-06-01";
    const d2 = "2026-06-02";
    expect(hiddenForDate(d1)).not.toEqual(hiddenForDate(d2));
  });
});

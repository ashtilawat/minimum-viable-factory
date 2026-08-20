import { describe, expect, it } from "vitest";
import { buildShareText, shareTitle } from "../lib/share";
import { PING_EPOCH_UTC } from "../lib/epoch";

const utcDate = "2026-01-01";

describe("share", () => {
  it("win in k taps: header, miss lines, target", () => {
    const text = buildShareText(
      utcDate,
      [
        { r: 0, c: 0, d: 10 },
        { r: 1, c: 1, d: 8 },
        { r: 2, c: 2, d: 0 },
      ],
      true,
    );
    expect(text).toBe("PING #1 3/4\n📡10\n📡8\n🎯");
  });

  it("never includes 📡0 on miss lines", () => {
    const text = buildShareText(utcDate, [{ r: 3, c: 3, d: 0 }], true);
    expect(text).not.toContain("📡0");
    expect(text).toBe("PING #1 1/4\n🎯");
  });

  it("honest lose: X/4 plus exactly four distance lines", () => {
    const text = buildShareText(
      utcDate,
      [
        { r: 0, c: 0, d: 12 },
        { r: 1, c: 0, d: 11 },
        { r: 2, c: 0, d: 10 },
        { r: 3, c: 0, d: 9 },
      ],
      false,
    );
    expect(text).toBe(
      "PING #1 X/4\n📡12\n📡11\n📡10\n📡9",
    );
    expect(text).not.toContain("🎯");
  });

  it("share title and text never contain row/col pair or H", () => {
    const title = shareTitle(utcDate);
    const text = buildShareText(
      utcDate,
      [
        { r: 7, c: 8, d: 4 },
        { r: 7, c: 9, d: 3 },
        { r: 7, c: 10, d: 2 },
        { r: 7, c: 11, d: 1 },
      ],
      false,
    );
    expect(title).toBe("PING #1");
    expect(text).not.toMatch(/\d,\d/);
    expect(text).not.toMatch(/7.*8/);
  });

  it("puzzle number derives from epoch", () => {
    expect(PING_EPOCH_UTC).toBe("2026-01-01");
  });
});

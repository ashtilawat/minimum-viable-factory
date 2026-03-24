import { cn, midpoint } from "@/lib/utils";

describe("cn()", () => {
  it("returns empty string for no arguments", () => {
    expect(cn()).toBe("");
  });

  it("concatenates simple class strings", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("handles conditional classes via clsx", () => {
    expect(cn("base", false && "not-included", "included")).toBe(
      "base included"
    );
  });

  it("deduplicates conflicting Tailwind classes (last wins)", () => {
    // tailwind-merge removes the first conflicting class
    const result = cn("p-4", "p-8");
    expect(result).toBe("p-8");
  });

  it("merges complex conflicting Tailwind utilities", () => {
    const result = cn("text-red-500", "text-blue-500");
    expect(result).toBe("text-blue-500");
  });

  it("accepts array and object forms from clsx", () => {
    // Note: 'flex' and 'block' are both display utilities; twMerge keeps the last one.
    // The final result has 'block' (from the object) instead of 'flex'.
    const result = cn(["flex", "items-center"], { hidden: false, block: true });
    expect(result).toBe("items-center block");
  });

  it("filters out undefined and null values", () => {
    expect(cn("a", undefined, null, "b")).toBe("a b");
  });
});

describe("midpoint()", () => {
  it("returns 1.0 when both arguments are null (first ever item)", () => {
    expect(midpoint(null, null)).toBe(1.0);
  });

  it("returns b/2 when a is null (insert before b)", () => {
    expect(midpoint(null, 4)).toBe(2);
    expect(midpoint(null, 1)).toBe(0.5);
    expect(midpoint(null, 0.5)).toBe(0.25);
  });

  it("returns a + 1 when b is null (insert after a)", () => {
    expect(midpoint(1, null)).toBe(2);
    expect(midpoint(3.5, null)).toBe(4.5);
    expect(midpoint(0, null)).toBe(1);
  });

  it("returns the arithmetic midpoint when both are provided", () => {
    expect(midpoint(1, 3)).toBe(2);
    expect(midpoint(2, 4)).toBe(3);
    expect(midpoint(1, 2)).toBe(1.5);
  });

  it("handles fractional inputs correctly", () => {
    expect(midpoint(1.5, 2.5)).toBe(2);
    expect(midpoint(0.25, 0.75)).toBe(0.5);
  });

  it("handles equal values (degenerate case)", () => {
    // Edge case: a === b → midpoint is a (or b)
    expect(midpoint(2, 2)).toBe(2);
  });

  it("handles a > b (reverse order input)", () => {
    // No guard on ordering — result is just arithmetic midpoint
    expect(midpoint(5, 1)).toBe(3);
  });

  it("handles very small fractional values without losing precision significantly", () => {
    const result = midpoint(0.0001, 0.0002);
    expect(result).toBeCloseTo(0.00015, 10);
  });
});

import { describe, it, expect } from "vitest";
import { shotOverdue } from "./shotReminder";

describe("shotOverdue", () => {
  const END = 10_000_000;

  it("stays off outside a raid and once the raid's end has passed", () => {
    expect(shotOverdue(1_000_000, null, 0, 0, 30)).toBe(false);
    expect(shotOverdue(END, END, 0, 0, 30)).toBe(false);
  });

  it("turns on at the delay, not before", () => {
    const seen = 1_000_000;
    expect(shotOverdue(seen + 29_999, END, 0, seen, 30)).toBe(false);
    expect(shotOverdue(seen + 30_000, END, 0, seen, 30)).toBe(true);
    expect(shotOverdue(seen + 600_000, END, 0, seen, 30)).toBe(true);
  });

  it("counts from the raid's start until the first screenshot, then from the last screenshot", () => {
    const seen = 1_000_000;
    // A screenshot turns it straight off.
    expect(shotOverdue(seen + 65_000, END, seen + 65_000, seen, 30)).toBe(false);
    expect(shotOverdue(seen + 94_999, END, seen + 65_000, seen, 30)).toBe(false);
    expect(shotOverdue(seen + 95_000, END, seen + 65_000, seen, 30)).toBe(true);
    // A screenshot from the last raid does not count against this one.
    expect(shotOverdue(seen + 30_000, END, seen - 500_000, seen, 30)).toBe(true);
  });
});

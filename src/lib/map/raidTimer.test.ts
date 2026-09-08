import { describe, it, expect } from "vitest";
import { raidTimeLeft } from "./raidTimer";

const MIN = 60_000;

describe("raidTimeLeft", () => {
  it("counts down from the raid length in mm:ss", () => {
    expect(raidTimeLeft(0, 40, 0)).toBe("40:00");
    expect(raidTimeLeft(0, 40, 61_500)).toBe("38:58");
    expect(raidTimeLeft(1000, 40, 39 * MIN + 1000)).toBe("01:00");
  });

  it("rounds down to the second the way the in-game watch does", () => {
    expect(raidTimeLeft(0, 40, 999)).toBe("39:59");
  });

  it("holds 00:00 for the minute after the raid ends, then hides", () => {
    expect(raidTimeLeft(0, 40, 40 * MIN)).toBe("00:00");
    expect(raidTimeLeft(0, 40, 40 * MIN + 59_000)).toBe("00:00");
    expect(raidTimeLeft(0, 40, 41 * MIN)).toBeNull();
  });

  it("hides without a start or a raid length, and for a start in the future", () => {
    expect(raidTimeLeft(null, 40, 5)).toBeNull();
    expect(raidTimeLeft(0, undefined, 5)).toBeNull();
    expect(raidTimeLeft(0, 0, 5)).toBeNull();
    expect(raidTimeLeft(10_000, 40, 5)).toBeNull();
  });
});

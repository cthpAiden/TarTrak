import { describe, it, expect } from "vitest";
import { raidTimeLeft } from "./raidTimer";

const MIN = 60_000;

describe("raidTimeLeft", () => {
  it("counts down to the raid's end in mm:ss", () => {
    expect(raidTimeLeft(40 * MIN, 0)).toBe("40:00");
    expect(raidTimeLeft(40 * MIN, 61_500)).toBe("38:58");
    expect(raidTimeLeft(40 * MIN + 1000, 39 * MIN + 1000)).toBe("01:00");
  });

  it("rounds down to the second the way the in-game watch does", () => {
    expect(raidTimeLeft(40 * MIN, 999)).toBe("39:59");
  });

  it("holds 00:00 for the minute after the raid ends, then hides", () => {
    expect(raidTimeLeft(40 * MIN, 40 * MIN)).toBe("00:00");
    expect(raidTimeLeft(40 * MIN, 40 * MIN + 59_000)).toBe("00:00");
    expect(raidTimeLeft(40 * MIN, 41 * MIN)).toBeNull();
  });

  it("hides without an end", () => {
    expect(raidTimeLeft(null, 5)).toBeNull();
  });
});

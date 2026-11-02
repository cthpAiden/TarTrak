import { describe, it, expect } from "vitest";
import { clockJump, msToNextSecond, raidTimeLeft, raidTimeLow } from "./raidTimer";

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

describe("msToNextSecond", () => {
  it("lands just past the edge where the shown second changes", () => {
    const end = 40 * MIN;
    for (const now of [0, 1, 345, 999, 1000, 61_500, 40 * MIN - 1, 40 * MIN + 250]) {
      const wait = msToNextSecond(end, now);
      expect(wait).toBeGreaterThan(0);
      expect(wait).toBeLessThanOrEqual(1005);
      // Just before the wait the old second still shows; at the wait the next one does.
      expect(raidTimeLeft(end, now + wait - 6)).toBe(raidTimeLeft(end, now));
      if (now <= end - 1000) expect(raidTimeLeft(end, now + wait)).not.toBe(raidTimeLeft(end, now));
    }
  });

  it("follows an end that is not on a whole second", () => {
    expect(msToNextSecond(40 * MIN + 280, 0)).toBe(285);
    expect(msToNextSecond(40 * MIN + 280, 300)).toBe(985);
  });
});

describe("clockJump", () => {
  it("is 0 when the wall clock and the monotonic clock move together, late timers included", () => {
    expect(clockJump(1000, 50, 2003, 1052)).toBe(0);
    expect(clockJump(1000, 50, 9000, 8050)).toBe(0);
    expect(clockJump(1000, 50, 1950, 1050)).toBe(0);
  });

  it("is how far the PC's clock was set, forward or back", () => {
    expect(clockJump(1000, 50, 1000 + 1000 + 71_000, 1050)).toBe(71_000);
    expect(clockJump(1000, 50, 1000 + 1000 - 45_000, 1050)).toBe(-45_000);
  });
});

describe("raidTimeLow", () => {
  it("is on from 10:00 left down to the end", () => {
    expect(raidTimeLow(40 * MIN, 30 * MIN - 1000)).toBe(false); // 10:01
    expect(raidTimeLow(40 * MIN, 30 * MIN - 999)).toBe(true); // 10:00, rounded down like the pill
    expect(raidTimeLow(40 * MIN, 30 * MIN)).toBe(true);
    expect(raidTimeLow(40 * MIN, 39 * MIN)).toBe(true);
    expect(raidTimeLow(40 * MIN, 40 * MIN + 30_000)).toBe(true);
  });

  it("is off before 10:00 and without a raid", () => {
    expect(raidTimeLow(40 * MIN, 29 * MIN)).toBe(false);
    expect(raidTimeLow(null, 0)).toBe(false);
  });
});

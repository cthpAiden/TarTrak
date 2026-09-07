import { describe, it, expect } from "vitest";
import { bearingDeg, relativeDeg, tapeTicks, tapePosition, pad3, PX_PER_DEG } from "./compass";

describe("bearingDeg", () => {
  it("agrees with the heading line: a point straight ahead has my yaw as its bearing", () => {
    const me = { x: 120.5, z: -40.25 };
    for (const yaw of [0, 90, 180, 270, 359.5, 41]) {
      const rad = (yaw * Math.PI) / 180;
      const ahead = { x: me.x + Math.sin(rad) * 50, z: me.z + Math.cos(rad) * 50 };
      expect(bearingDeg(me, ahead)).toBeCloseTo(yaw, 6);
    }
  });

  it("is 0 for a zero vector", () => {
    expect(bearingDeg({ x: 1, z: 2 }, { x: 1, z: 2 })).toBe(0);
  });
});

describe("relativeDeg", () => {
  it("wraps across north", () => {
    expect(relativeDeg(10, 350)).toBe(20);
    expect(relativeDeg(350, 10)).toBe(-20);
  });

  it("puts the exact opposite at -180", () => {
    expect(relativeDeg(180, 0)).toBe(-180);
    expect(relativeDeg(30, 210)).toBe(-180);
  });
});

describe("tapeTicks", () => {
  const W = 324;

  it("labels every 30° and has no duplicates, in left-to-right order", () => {
    const ticks = tapeTicks(214, W);
    expect(ticks.filter((t) => t.major).map((t) => t.deg)).toEqual([180, 210, 240]);
    expect(new Set(ticks.map((t) => t.deg)).size).toBe(ticks.length);
    for (let i = 1; i < ticks.length; i++) expect(ticks[i].x).toBeGreaterThan(ticks[i - 1].x);
    for (const t of ticks) expect(t.x).toBeGreaterThanOrEqual(0);
    for (const t of ticks) expect(t.x).toBeLessThanOrEqual(W);
  });

  it("crosses the 0/360 seam", () => {
    const ticks = tapeTicks(5, W);
    expect(ticks.map((t) => t.deg)).toEqual([320, 330, 340, 350, 0, 10, 20, 30, 40, 50]);
    const north = ticks.find((t) => t.deg === 0)!;
    expect(north.x).toBe(W / 2 - 5 * PX_PER_DEG);
    expect(north.major).toBe(true);
  });

  it("puts the heading's own tick at the centre", () => {
    const ticks = tapeTicks(90, W);
    expect(ticks.find((t) => t.deg === 90)!.x).toBe(W / 2);
    expect(ticks.map((t) => t.deg)).toEqual([40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140]);
  });
});

describe("tapePosition", () => {
  const W = 324;

  it("places a bearing relative to the heading", () => {
    expect(tapePosition(220, 214, W)).toEqual({ x: W / 2 + 6 * PX_PER_DEG, clamped: false });
    expect(tapePosition(350, 10, W)).toEqual({ x: W / 2 - 20 * PX_PER_DEG, clamped: false });
  });

  it("is not mirrored: facing north (+z), a point to the east (+x) lands right of centre", () => {
    // Unity is y-up and left-handed: standing at the origin facing +z, +x is on my right, and the
    // heading line in markers.ts turns from +z towards +x as yaw grows. So a target 30° clockwise
    // of my facing must sit to the right of the centre line, and one to the west to the left.
    const me = { x: 0, z: 0 };
    const rad = (30 * Math.PI) / 180;
    const rightOfMe = { x: Math.sin(rad) * 10, z: Math.cos(rad) * 10 };
    const leftOfMe = { x: -Math.sin(rad) * 10, z: Math.cos(rad) * 10 };
    expect(tapePosition(bearingDeg(me, rightOfMe), 0, W).x).toBeCloseTo(W / 2 + 30 * PX_PER_DEG, 6);
    expect(tapePosition(bearingDeg(me, leftOfMe), 0, W).x).toBeCloseTo(W / 2 - 30 * PX_PER_DEG, 6);
  });

  it("pins an off-tape bearing to the edge it lies beyond", () => {
    expect(tapePosition(300, 0, W)).toEqual({ x: 6, clamped: true });
    expect(tapePosition(60, 0, W)).toEqual({ x: W - 6, clamped: true });
    expect(tapePosition(180, 0, W)).toEqual({ x: 6, clamped: true });
  });
});

describe("pad3", () => {
  it("rounds and zero-pads to three digits", () => {
    expect(pad3(41.2)).toBe("041");
    expect(pad3(214)).toBe("214");
    expect(pad3(7)).toBe("007");
    expect(pad3(359.7)).toBe("000");
    expect(pad3(360)).toBe("000");
  });
});

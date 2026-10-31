import { describe, it, expect } from "vitest";
import { mmss, raidSpan, shotStats, stepShot, trailAt } from "./replay";
import type { RaidRecord, TrailPoint } from "./record";

const pt = (t: number): TrailPoint => ({ t, x: t, y: 0, z: 0, yaw: 0 });
const raid = (over: Partial<RaidRecord> = {}): RaidRecord => ({
  map: "customs",
  startedAt: 0,
  endsAt: 2_400_000,
  leftAt: 600_000,
  me: [pt(20_000), pt(60_000), pt(200_000), pt(230_000)],
  mates: [],
  ...over,
});

describe("raidSpan", () => {
  it("runs from my spawn to my leaving, or past it to a teammate's last position", () => {
    expect(raidSpan(raid())).toEqual({ start: 0, end: 600_000 });
    expect(raidSpan(raid({ mates: [{ name: "Rook", color: "#fff", points: [pt(900_000)] }] }))).toEqual({ start: 0, end: 900_000 });
    expect(raidSpan(raid({ leftAt: null }))).toEqual({ start: 0, end: 230_000 });
  });
});

describe("shotStats", () => {
  it("counts my screenshots and measures gaps from spawn to leaving", () => {
    const s = shotStats(raid());
    expect(s.count).toBe(4);
    expect(s.everyS).toBe(150);
    // The longest is from my last screenshot to leaving.
    expect(s.longestMs).toBe(370_000);
    expect(s.gaps).toEqual([
      { from: 60_000, to: 200_000 },
      { from: 230_000, to: 600_000 },
    ]);
  });

  it("measures a raid I am still in up to my last screenshot", () => {
    expect(shotStats(raid({ leftAt: null })).longestMs).toBe(140_000);
  });
});

describe("trailAt", () => {
  const pts = [pt(0), pt(100), pt(200), pt(300), pt(400)];

  it("cuts the trail at the playhead: faint before the tail, bright in it, the marker on the newest", () => {
    const t = trailAt(pts, 350, 150);
    expect(t.old.map((p) => p.t)).toEqual([0, 100, 200]);
    expect(t.tail.map((p) => p.t)).toEqual([200, 300]);
    expect(t.last?.t).toBe(300);
  });

  it("has nothing before the first position, and no faint part while all of it is recent", () => {
    expect(trailAt(pts, -1, 150)).toEqual({ old: [], tail: [], last: null });
    expect(trailAt(pts, 100, 150).old).toEqual([]);
    expect(trailAt(pts, 100, 150).tail.map((p) => p.t)).toEqual([0, 100]);
  });
});

describe("stepShot and mmss", () => {
  it("steps to my previous or next screenshot", () => {
    expect(stepShot(raid(), 60_000, 1)).toBe(200_000);
    expect(stepShot(raid(), 60_000, -1)).toBe(20_000);
    expect(stepShot(raid(), 20_000, -1)).toBeNull();
    expect(stepShot(raid(), 230_000, 1)).toBeNull();
  });

  it("writes minutes and seconds", () => {
    expect(mmss(0)).toBe("0:00");
    expect(mmss(1_040_999)).toBe("17:20");
    expect(mmss(3_725_000)).toBe("62:05");
  });
});

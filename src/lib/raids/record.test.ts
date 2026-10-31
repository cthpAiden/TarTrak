import { describe, it, expect } from "vitest";
import { addMate, addOwn, coerceRaid, keepRaid, startRaid, MAX_TRAIL_POINTS, type MateUpdate, type RaidRecord } from "./record";

const pos = { x: 1, y: 2, z: 3, yaw: 90 };
const mate = (over: Partial<MateUpdate> = {}): MateUpdate => ({
  name: "Rook",
  color: "#5aa9e6",
  map: "customs",
  x: 10,
  y: 0,
  z: 20,
  yaw: 45,
  receivedAt: 1500,
  ...over,
});
const withShot = (): RaidRecord => addOwn(startRaid("customs", 1000, 9000), null, pos, 1200)!;

describe("addOwn", () => {
  it("adds my screenshot with its time, and fills in the map when the raid started without one", () => {
    const r = addOwn(startRaid(null, 1000, 9000), "woods", pos, 1200)!;
    expect(r.map).toBe("woods");
    expect(r.me).toEqual([{ t: 1200, ...pos }]);
  });

  it("takes nothing after I leave", () => {
    expect(addOwn({ ...withShot(), leftAt: 2000 }, null, pos, 2100)).toBeNull();
  });

  it("stops at the trail's limit", () => {
    const full = { ...withShot(), me: Array.from({ length: MAX_TRAIL_POINTS }, (_, i) => ({ t: i, ...pos })) };
    expect(addOwn(full, null, pos, 5)).toBeNull();
  });
});

describe("addMate", () => {
  it("starts a trail per teammate name and adds to it", () => {
    let r = addMate(withShot(), mate())!;
    r = addMate(r, mate({ x: 11, receivedAt: 1600 }))!;
    r = addMate(r, mate({ name: "Vex", receivedAt: 1700 }))!;
    expect(r.mates.map((m) => [m.name, m.points.length])).toEqual([["Rook", 2], ["Vex", 1]]);
    expect(r.mates[0].points[1]).toEqual({ t: 1600, x: 11, y: 0, z: 20, yaw: 45 });
  });

  it("skips a resend of the same position (a reconnect), but not a new spot", () => {
    const r = addMate(withShot(), mate())!;
    expect(addMate(r, mate({ receivedAt: 1900 }))).toBeNull();
    expect(addMate(r, mate({ yaw: 46, receivedAt: 1900 }))).not.toBeNull();
  });

  it("takes only positions from my spawn to the raid's end, on the raid's map or with no map", () => {
    const r = withShot();
    expect(addMate(r, mate({ receivedAt: 999 }))).toBeNull();
    expect(addMate(r, mate({ receivedAt: 9001 }))).toBeNull();
    expect(addMate(r, mate({ map: "woods" }))).toBeNull();
    expect(addMate(r, mate({ map: null }))).not.toBeNull();
  });

  it("keeps following teammates after I leave, if I took a screenshot in the raid", () => {
    expect(addMate({ ...withShot(), leftAt: 2000 }, mate({ receivedAt: 3000 }))).not.toBeNull();
    expect(addMate({ ...startRaid("customs", 1000, 9000), leftAt: 2000 }, mate({ receivedAt: 3000 }))).toBeNull();
  });
});

describe("keepRaid and coerceRaid", () => {
  it("keeps a raid only with a map and a screenshot of mine", () => {
    expect(keepRaid(startRaid("customs", 1, 2))).toBe(false);
    expect(keepRaid(withShot())).toBe(true);
    expect(keepRaid({ ...withShot(), map: null })).toBe(false);
  });

  it("reads a saved raid back and drops what is not one", () => {
    const r = { ...addMate(withShot(), mate())!, leftAt: 2000 };
    expect(coerceRaid(JSON.parse(JSON.stringify(r)))).toEqual(r);
    expect(coerceRaid(null)).toBeNull();
    expect(coerceRaid({ ...r, startedAt: "x" })).toBeNull();
    expect(coerceRaid({ ...r, me: [] })).toBeNull();
    const bad = coerceRaid({ ...r, me: [...r.me, { t: 1, x: "a" }], mates: [...r.mates, { name: 3 }] })!;
    expect(bad.me).toEqual(r.me);
    expect(bad.mates).toEqual(r.mates);
  });
});

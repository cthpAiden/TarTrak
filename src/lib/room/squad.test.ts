import { describe, it, expect } from "vitest";
import { safeColor, squadRows } from "./squad";
import type { Teammate } from "../state/app.svelte";

function mate(over: Partial<Teammate>): Teammate {
  return {
    id: "id",
    name: "Mate",
    color: "#fff",
    map: "customs",
    x: 0,
    y: 0,
    z: 0,
    yaw: 0,
    ts: 0,
    receivedAt: 0,
    ...over,
  };
}

const names = (key: string) => (key === "customs" ? "Customs" : key === "woods" ? "Woods" : null);
const me = { map: "customs", pos: { x: 0, z: 0 } };

describe("squadRows", () => {
  it("puts same-map teammates first, then sorts by name", () => {
    const rows = squadRows(
      [
        mate({ id: "d", name: "Dana", map: "woods" }),
        mate({ id: "c", name: "Carl", map: "woods" }),
        mate({ id: "b", name: "Bea" }),
        mate({ id: "a", name: "Abe" }),
      ],
      me,
      0,
      names,
    );
    expect(rows.map((r) => r.id)).toEqual(["a", "b", "c", "d"]);
    expect(rows.map((r) => r.sameMap)).toEqual([true, true, false, false]);
  });

  it("measures distance in whole metres on the same map only", () => {
    const rows = squadRows([mate({ id: "a", x: 30, z: 40 }), mate({ id: "b", map: "woods", x: 30, z: 40 })], me, 0, names);
    expect(rows[0].distanceM).toBe(50);
    expect(rows[1].distanceM).toBeNull();
  });

  it("names the other map and leaves distance out", () => {
    const [row] = squadRows([mate({ id: "a", map: "woods" })], me, 0, names);
    expect(row).toMatchObject({ sameMap: false, mapName: "Woods", distanceM: null });
  });

  it("falls back to no map name for an unknown map", () => {
    const [row] = squadRows([mate({ id: "a", map: "atlantis" })], me, 0, names);
    expect(row).toMatchObject({ mapName: null, sameMap: false, mapUnknown: false });
  });

  it("puts a teammate with no map of their own on my map, flagged as unknown", () => {
    const [row] = squadRows([mate({ id: "a", map: null, x: 3, z: 4 })], me, 0, names);
    expect(row).toMatchObject({ sameMap: true, mapUnknown: true, mapName: null, distanceM: 5 });
  });

  it("keeps everyone off my map while I have no map", () => {
    const rows = squadRows([mate({ id: "a" }), mate({ id: "b", map: null })], { map: null, pos: null }, 0, names);
    expect(rows.map((r) => r.sameMap)).toEqual([false, false]);
  });

  it("knows the same map without my position, but has no distance then", () => {
    const [row] = squadRows([mate({ id: "a", x: 30, z: 40 })], { map: "customs", pos: null }, 0, names);
    expect(row).toMatchObject({ sameMap: true, distanceM: null, mapName: "Customs" });
  });

  it("lists a hello-only teammate as present without a position", () => {
    const [row] = squadRows([mate({ id: "a", map: null, noPosition: true })], me, 0, names);
    expect(row).toMatchObject({ noPosition: true, sameMap: false, mapUnknown: false, distanceM: null });
  });

  it("reports age in whole seconds, never negative", () => {
    const rows = squadRows([mate({ id: "a", receivedAt: 1_000 }), mate({ id: "b", receivedAt: 20_000 })], me, 10_400, names);
    expect(rows.map((r) => r.ageSec)).toEqual([9, 0]);
  });

  it("carries name and colour through", () => {
    const [row] = squadRows([mate({ id: "a", name: "Abe", color: "#abcdef" })], me, 0, names);
    expect(row).toMatchObject({ id: "a", name: "Abe", color: "#abcdef" });
  });
});

describe("safeColor", () => {
  it("passes hex colours and replaces anything else", () => {
    expect(safeColor("#abc")).toBe("#abc");
    expect(safeColor("#3aa0ff")).toBe("#3aa0ff");
    expect(safeColor("red")).toBe("#888888");
    expect(safeColor("#fff; background: url(x)")).toBe("#888888");
  });
});

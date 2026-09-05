import { describe, it, expect } from "vitest";
import { distanceM, routeGroups } from "./route";
import type { MapPoint } from "../layers/points";

function pt(id: string, group: MapPoint["group"], category: string, name: string): MapPoint {
  return { id, group, category, name, mapKey: "customs", x: 0, y: 0, z: 0, details: [] };
}

describe("distanceM", () => {
  it("measures the flat distance in whole metres", () => {
    expect(distanceM({ x: 0, z: 0 }, { x: 3, z: 4 })).toBe(5);
    expect(distanceM({ x: -10.4, z: 2 }, { x: 10.4, z: 2 })).toBe(21);
  });
});

describe("routeGroups", () => {
  it("lists only extracts, PMC-usable groups first, names sorted, under the filter labels", () => {
    const groups = routeGroups([
      pt("t", "extracts", "transit", "Transit to Woods"),
      pt("s", "extracts", "scav", "Scav gate"),
      pt("p2", "extracts", "pmc", "ZB-013"),
      pt("p1", "extracts", "pmc", "Crossroads"),
      pt("c", "extracts", "coop", "Boiler Room (Co-op)"),
      pt("x", "loot", "safe", "Safe"),
    ]);
    expect(groups.map((g) => [g.label, g.items.map((p) => p.name)])).toEqual([
      ["PMC Extracts", ["Crossroads", "ZB-013"]],
      ["Co-op Extracts (PMC + Scav)", ["Boiler Room (Co-op)"]],
      ["SCAV Extracts", ["Scav gate"]],
      ["Transit Zones", ["Transit to Woods"]],
    ]);
  });

  it("is empty for a map without extracts", () => {
    expect(routeGroups([pt("x", "loot", "safe", "Safe")])).toEqual([]);
  });
});

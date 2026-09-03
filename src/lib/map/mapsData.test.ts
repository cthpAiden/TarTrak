import { describe, it, expect } from "vitest";
import { loadMapDefs, getMapDef, floorForHeight } from "./mapsData";

describe("loadMapDefs", () => {
  it("loads the interactive maps with display names", () => {
    const defs = loadMapDefs();
    const keys = defs.map((d) => d.key);
    expect(keys).toEqual(expect.arrayContaining(["customs", "lighthouse", "streets-of-tarkov", "ground-zero", "factory", "woods"]));
    expect(getMapDef("streets-of-tarkov")?.name).toBe("Streets of Tarkov");
    expect(getMapDef("lighthouse")?.transform).toEqual([0.2, 0, 0.2, 0]);
    expect(getMapDef("customs")?.svgPath).toMatch(/Customs\.svg$/);
    expect(getMapDef("nope")).toBeUndefined();
  });
});

describe("floorForHeight", () => {
  it("returns null on ground and the layer name above/below thresholds (streets)", () => {
    const def = getMapDef("streets-of-tarkov")!;
    expect(floorForHeight(def, { x: 0, y: 2, z: 0 })).toBeNull();
    expect(floorForHeight(def, { x: 0, y: 12, z: 0 })).toBe("2nd Floor");
    expect(floorForHeight(def, { x: 0, y: 17, z: 0 })).toBe("3rd Floor");
    expect(floorForHeight(def, { x: 0, y: -8, z: 0 })).toBe("Underground");
  });

  it("respects extent bounds when present (customs dorms)", () => {
    const def = getMapDef("customs")!;
    // dorms bounds [[243,190],[165,125]], height 2.7..6.5 -> 2nd floor
    expect(floorForHeight(def, { x: 200, y: 4, z: 150 })).toBe("2nd Floor");
    // same height far away from any bounded extent -> ground
    expect(floorForHeight(def, { x: -300, y: 4, z: 200 })).toBeNull();
  });
});

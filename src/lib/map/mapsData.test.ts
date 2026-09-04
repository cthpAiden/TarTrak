import { describe, it, expect } from "vitest";
import { loadMapDefs, getMapDef, floorForHeight, onLayer, visibleOnFloor, type MapDef } from "./mapsData";

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

  it("carries landmark labels", () => {
    const labels = getMapDef("streets-of-tarkov")!.labels;
    expect(labels.length).toBeGreaterThan(40);
    expect(labels[0]).toMatchObject({ text: expect.any(String), position: [expect.any(Number), expect.any(Number)] });
  });

  it("excludes non-interactive projections", () => {
    const defs = loadMapDefs();
    expect(defs).toHaveLength(13);
    expect(getMapDef("customs-2d")).toBeUndefined();
  });
});

describe("floorForHeight", () => {
  it("returns null on ground and the layer name above/below thresholds (streets)", () => {
    const def = getMapDef("streets-of-tarkov")!;
    expect(floorForHeight(def, { x: 0, y: 2, z: 0 })).toBeNull();
    expect(floorForHeight(def, { x: 0, y: 12, z: 0 })).toBe("2nd Floor");
    expect(floorForHeight(def, { x: 0, y: 17, z: 0 })).toBe("3rd Floor");
    expect(floorForHeight(def, { x: 0, y: -8, z: 0 })).toBe("Underground");
    expect(floorForHeight(def, { x: 0, y: 15, z: 0 })).toBe("3rd Floor"); // half-open boundary: 15 ends 2nd Floor [10,15), starts 3rd [15,20)
  });

  it("respects extent bounds when present (customs dorms)", () => {
    const def = getMapDef("customs")!;
    // dorms bounds [[243,190],[165,125]], height 2.7..6.5 -> 2nd floor
    expect(floorForHeight(def, { x: 200, y: 4, z: 150 })).toBe("2nd Floor");
    // same height far away from any bounded extent -> ground
    expect(floorForHeight(def, { x: -300, y: 4, z: 200 })).toBeNull();
  });
});

function bareDef(over: Partial<MapDef> = {}): MapDef {
  return {
    key: "t",
    name: "T",
    transform: [1, 0, 1, 0],
    coordinateRotation: 0,
    bounds: [
      [0, 0],
      [100, 100],
    ],
    layers: [],
    labels: [],
    minZoom: 1,
    maxZoom: 5,
    ...over,
  };
}

describe("onLayer", () => {
  it("never claims a marker for a layer without extents", () => {
    expect(onLayer({ name: "x" }, 0, 0, 5, 5)).toBe(false);
  });

  it("reports full containment only when the whole span fits the extent", () => {
    const layer = { name: "x", extents: [{ height: [10, 15] as [number, number] }] };
    expect(onLayer(layer, 0, 0, 12, 12)).toBe("full");
    expect(onLayer(layer, 0, 0, 1000, -1000)).toBe("partial");
    expect(onLayer(layer, 0, 0, 9, 9)).toBe(false);
    // half-open: top === height[1] is outside
    expect(onLayer(layer, 0, 0, 15, 15)).toBe(false);
  });

  it("requires the point to sit inside one of the extent bounds", () => {
    const layer = {
      name: "x",
      extents: [
        {
          height: [2.7, 6.5] as [number, number],
          bounds: [
            [
              [243, 190],
              [165, 125],
            ],
          ] as [[number, number], [number, number], string?][],
        },
      ],
    };
    expect(onLayer(layer, 200, 150, 4, 4)).toBe("full");
    expect(onLayer(layer, -300, 200, 4, 4)).toBe(false);
  });
});

describe("visibleOnFloor", () => {
  const streets = getMapDef("streets-of-tarkov")!;
  const customs = getMapDef("customs")!;

  it("hides a 2nd-floor point on the base level and shows it on its floor", () => {
    expect(visibleOnFloor(streets, null, 0, 0, 12)).toBe(false);
    expect(visibleOnFloor(streets, "2nd Floor", 0, 0, 12)).toBe(true);
  });

  it("hides a ground point while a floor is active", () => {
    expect(visibleOnFloor(streets, null, 0, 0, 2)).toBe(true);
    expect(visibleOnFloor(streets, "2nd Floor", 0, 0, 2)).toBe(false);
  });

  it("hides a point inside a bounded extent of an inactive floor (customs dorms)", () => {
    expect(visibleOnFloor(customs, null, 200, 150, 4)).toBe(false);
    expect(visibleOnFloor(customs, "2nd Floor", 200, 150, 4)).toBe(true);
  });

  it("keeps a point at the same height but outside every bounded extent on the base level", () => {
    expect(visibleOnFloor(customs, null, -300, 200, 4)).toBe(true);
  });

  it("shows everything on a map without layers", () => {
    const def = bareDef();
    expect(visibleOnFloor(def, null, 0, 0, -500)).toBe(true);
    expect(visibleOnFloor(def, null, 0, 0, 500)).toBe(true);
  });

  it("excludes a point below heightRange on the base level", () => {
    const def = bareDef({ heightRange: [0, 10] });
    expect(visibleOnFloor(def, null, 0, 0, -5)).toBe(false);
    expect(visibleOnFloor(def, null, 0, 0, 5)).toBe(true);
  });

  it("keeps a label whose span covers the whole map visible on every floor", () => {
    // Landmark labels without top/bottom span [-1000, 1000]; they must not vanish on any floor.
    expect(visibleOnFloor(streets, null, 0, 0, 0, 1000, -1000)).toBe(true);
    expect(visibleOnFloor(streets, "2nd Floor", 0, 0, 0, 1000, -1000)).toBe(true);
    expect(visibleOnFloor(customs, null, 200, 150, 0, 1000, -1000)).toBe(true);
  });
});

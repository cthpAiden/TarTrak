import { describe, it, expect } from "vitest";
import { extractPoints, filterKey, categoryLabel, type MapPoint } from "./points";
import { QUEST_SCHEMA_VERSION, type QuestData } from "../quests/types";

const data: QuestData = {
  schemaVersion: QUEST_SCHEMA_VERSION,
  fetchedAt: 1,
  tasks: [],
  maps: [
    {
      id: "m1",
      name: "Streets of Tarkov",
      normalizedName: "streets",
      extracts: [
        { id: "e1", name: "Crossroads", faction: "pmc", position: { x: 1, y: 2, z: 3 } },
        { id: "e2", name: "Scav bridge", faction: "scav", position: { x: 4, y: 5, z: 6 } },
        { id: "e3", name: "Basement", faction: "shared", position: { x: 7, y: 8, z: 9 } },
        { id: "e4", name: "No pos", faction: "pmc", position: null },
      ],
      transits: [{ id: "tr1", description: "To Woods", position: { x: 10, y: 0, z: 11 } }],
      spawns: [
        { zoneName: "z1", position: { x: 20, y: 0, z: 21 }, sides: ["pmc", "scav"], categories: ["player"] },
        { zoneName: "z2", position: { x: 22, y: 0, z: 23 }, sides: ["scav"], categories: ["bot"] },
        { zoneName: "z3", position: { x: 24, y: 0, z: 25 }, sides: ["scav"], categories: ["boss"] },
        { zoneName: "z4", position: { x: 26, y: 0, z: 27 }, sides: ["scav"], categories: ["sniper"] },
      ],
      lootContainers: [
        { lootContainer: { id: "lc1", name: "Safe", normalizedName: "safe" }, position: { x: 30, y: 0, z: 31 } },
        { lootContainer: { id: "lc1", name: "Safe", normalizedName: "safe" }, position: { x: 32, y: 0, z: 33 } },
        { lootContainer: { id: "lc2", name: "Medcase", normalizedName: "medcase" }, position: { x: 34, y: 0, z: 35 } },
      ],
      lootLoose: [
        { position: { x: 36, y: 0, z: 37 }, items: ["i1"] },
        { position: null, items: ["i2"] },
      ],
      locks: [
        { lockType: "door", key: "k1", position: { x: 40, y: 0, z: 41 } },
        { lockType: "trunk", key: null, position: { x: 42, y: 0, z: 43 } },
      ],
      hazards: [{ hazardType: "sniper", name: "Sniper zone", position: { x: 50, y: 0, z: 51 } }],
      switches: [{ id: "sw1", name: "Power switch", position: { x: 60, y: 0, z: 61 } }],
      btrStations: [{ id: "bt1", name: "Stop 1", position: { x: 70, y: 0, z: 71 } }],
    },
    { id: "m2", name: "Woods", normalizedName: "woods", extracts: [] },
  ],
};

const points = extractPoints(data);
const inGroup = (g: string) => points.filter((p) => p.group === g);

describe("extractPoints", () => {
  it("derives extract categories, skips positionless entries, and adds transits", () => {
    const ex = inGroup("extracts");
    expect(ex.map((p) => p.category)).toEqual(["pmc", "scav", "shared", "transit"]);
    expect(ex.some((p) => p.name === "No pos")).toBe(false);
    const transit = ex[3];
    expect(filterKey(transit)).toBe("extracts/transit");
    expect(transit.name).toBe("To Woods");
  });

  it("derives spawn categories from sides and categories", () => {
    expect(inGroup("spawns").map((p) => p.category)).toEqual(["pmc", "scav", "boss", "sniper"]);
  });

  it("uses container normalized names for loot categories and container names for labels", () => {
    const loot = inGroup("loot");
    expect(loot.map((p) => p.category)).toEqual(["safe", "safe", "medcase"]);
    expect(loot.map((p) => p.name)).toEqual(["Safe", "Safe", "Medcase"]);
  });

  it("names locks by lock type", () => {
    const locks = inGroup("locks");
    expect(locks.map((p) => p.category)).toEqual(["door", "trunk"]);
    expect(locks.map((p) => p.name)).toEqual(["Locked door", "Locked trunk"]);
  });

  it("maps loose loot into one category", () => {
    const loose = inGroup("lootLoose");
    expect(loose.map((p) => p.category)).toEqual(["item"]);
    expect(loose[0].name).toBe("Loose loot");
  });

  it("maps hazards, switches and BTR stations", () => {
    expect(inGroup("hazards").map((p) => p.category)).toEqual(["sniper"]);
    expect(inGroup("switches").map((p) => p.category)).toEqual(["switch"]);
    expect(inGroup("btr").map((p) => p.category)).toEqual(["stop"]);
  });

  it("tags every point with the map key and tolerates maps with no optional arrays", () => {
    expect(points.every((p) => p.mapKey === "streets")).toBe(true);
    expect(points.some((p) => p.mapKey === "woods")).toBe(false);
    expect(() => extractPoints({ ...data, maps: [data.maps[1]] })).not.toThrow();
  });

  it("gives every point a unique id and synthesises ids for spawns", () => {
    const ids = points.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(inGroup("spawns").map((p) => p.id)).toEqual([
      "spawns/pmc/0",
      "spawns/scav/1",
      "spawns/boss/2",
      "spawns/sniper/3",
    ]);
  });
});

describe("filterKey", () => {
  it("joins group and category", () => {
    expect(filterKey({ group: "loot", category: "safe" })).toBe("loot/safe");
  });
});

describe("categoryLabel", () => {
  it("prefers the fixed label, then a point name, then the slug", () => {
    expect(categoryLabel("extracts/pmc", [])).toBe("PMC Extracts");
    expect(categoryLabel("loot/safe", points)).toBe("Safe");
    expect(categoryLabel("loot/weapon_box", points as MapPoint[])).toBe("weapon_box");
  });
});

import { describe, it, expect } from "vitest";
import {
  findItem,
  extractPoints,
  filterKey,
  categoryLabel,
  CATEGORY_LABELS,
  GROUP_LABELS,
  GROUP_ORDER,
  type MapPoint,
} from "./points";
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
        {
          id: "e3",
          name: "Basement",
          faction: "shared",
          position: { x: 7, y: 8, z: 9 },
          switches: ["Basement switch"],
          requiredItem: { name: "Roubles", count: 20000 },
          outline: [[0, 0], [1, 0], [1, 1]],
          top: 12,
          bottom: 4,
        },
        { id: "e5", name: "Ark", faction: "coop", position: { x: 1, y: 1, z: 1 }, requiredItem: { name: "Ark key", count: 1 } },
        { id: "e4", name: "No pos", faction: "pmc", position: null },
      ],
      transits: [{ id: "tr1", description: "To Woods", position: { x: 10, y: 0, z: 11 }, conditions: "Labs keycard required" }],
      spawns: [
        { zoneName: "z1", position: { x: 20, y: 0, z: 21 }, sides: ["pmc", "scav"], categories: ["player"] },
        { zoneName: "z2", position: { x: 22, y: 0, z: 23 }, sides: ["scav"], categories: ["bot"] },
        { zoneName: "ZoneScavBase", position: { x: 24, y: 0, z: 25 }, sides: ["savage"], categories: ["boss"] },
        { zoneName: "ZoneCultist", position: { x: 26, y: 0, z: 27 }, sides: ["savage"], categories: ["boss"] },
        { zoneName: "ZoneRogue", position: { x: 28, y: 0, z: 29 }, sides: ["savage"], categories: ["boss"] },
        { zoneName: "ZoneNoBoss", position: { x: 80, y: 0, z: 81 }, sides: ["scav"], categories: ["boss", "bot"] },
        { zoneName: "ZoneNoBoss", position: { x: 82, y: 0, z: 83 }, sides: ["savage"], categories: ["boss"] },
        { zoneName: "z8", position: { x: 84, y: 0, z: 85 }, sides: ["scav"], categories: ["player"] },
        { zoneName: "z9", position: { x: 86, y: 0, z: 87 }, sides: ["savage"], categories: ["sniper"] },
        { zoneName: "z10", position: { x: 88, y: 0, z: 89 }, sides: ["scav"], categories: ["all"] },
        { zoneName: "z11", position: { x: 90, y: 0, z: 91 }, sides: ["bear"], categories: ["marksman"] },
      ],
      bosses: [
        { name: "Reshala", normalizedName: "reshala", spawnChance: 0.6, spawnKeys: ["ZoneScavBase", "ZoneDorms"] },
        { name: "Knight", normalizedName: "knight", spawnChance: 0.2, spawnKeys: ["ZoneScavBase"] },
        { name: "Cultist Priest", normalizedName: "cultist-priest", spawnChance: 0.35, spawnKeys: ["ZoneCultist"] },
        { name: "Rogue", normalizedName: "rogue", spawnChance: 0.5, spawnKeys: ["ZoneRogue"] },
        { name: "Rogue", normalizedName: "rogue", spawnChance: 0.5, spawnKeys: ["ZoneRogue"] },
      ],
      lootContainers: [
        { lootContainer: { id: "lc1", name: "Safe", normalizedName: "safe" }, position: { x: 30, y: 0, z: 31 } },
        { lootContainer: { id: "lc1", name: "Safe", normalizedName: "safe" }, position: { x: 32, y: 0, z: 33 } },
        { lootContainer: { id: "lc2", name: "Medcase", normalizedName: "medcase" }, position: { x: 34, y: 0, z: 35 } },
      ],
      lootLoose: [
        { position: { x: 36, y: 0, z: 37 }, items: ["Bolts", "Screws", "Nuts", "Nails"] },
        { position: { x: 38, y: 0, z: 39 }, items: ["Bolts", "Screws"] },
        { position: { x: 44, y: 0, z: 45 }, items: [] },
        { position: null, items: ["Wire"] },
      ],
      locks: [
        { lockType: "door", key: "Factory emergency exit key", position: { x: 40, y: 0, z: 41 } },
        { lockType: "trunk", key: null, position: { x: 42, y: 0, z: 43 } },
        { lockType: "door", key: "Lab key", needsPower: true, position: { x: 46, y: 0, z: 47 } },
      ],
      hazards: [
        { hazardType: "sniper", name: "Sniper zone", position: { x: 50, y: 0, z: 51 } },
        { hazardType: "mortar", name: "Mortar", position: { x: 52, y: 0, z: 53 }, outline: [[0, 0], [9, 0], [9, 9]], top: 7, bottom: -3 },
      ],
      switches: [
        {
          id: "sw1",
          name: "Power switch",
          position: { x: 60, y: 0, z: 61 },
          activates: [
            { operation: "Unlock", target: "Basement" },
            { operation: "Lock", target: "Alarm switch" },
          ],
        },
      ],
      btrStations: [{ id: "bt1", name: "Stop 1", position: { x: 70, y: 0, z: 71 } }],
      stationaryWeapons: [
        { id: "gun1", name: "NSV Utyos 12.7x108 heavy machine gun", position: { x: 72, y: 0, z: 73 } },
        { id: "gun1", name: "NSV Utyos 12.7x108 heavy machine gun", position: { x: 74, y: 0, z: 75 } },
        { id: "gun2", name: "AGS-30 30x29mm automatic grenade launcher", position: null },
      ],
    },
    { id: "m2", name: "Woods", normalizedName: "woods", extracts: [] },
  ],
};

const points = extractPoints(data);
const inGroup = (g: string) => points.filter((p) => p.group === g);

describe("extractPoints", () => {
  it("derives extract categories, skips positionless entries, and adds transits", () => {
    const ex = inGroup("extracts");
    expect(ex.map((p) => p.category)).toEqual(["pmc", "scav", "shared", "coop", "transit"]);
    expect(ex.some((p) => p.name === "No pos")).toBe(false);
    const transit = ex[4];
    expect(filterKey(transit)).toBe("extracts/transit");
    expect(transit.name).toBe("To Woods");
  });

  it("classifies spawns the way tarkov.dev does and skips the unusual ones", () => {
    expect(inGroup("spawns").map((p) => [p.category, p.name])).toEqual([
      ["pmc", "PMC spawn"],
      ["scav", "Scav spawn"],
      ["boss", "Reshala (60%), Knight (20%)"],
      ["cultist-priest", "Cultist Priest"],
      ["rogue", "Rogue"],
      ["scav", "Scav spawn"],
      ["sniper", "Sniper Scav"],
      ["scav", "Scav spawn"],
    ]);
  });

  it("uses container normalized names for loot categories and container names for labels", () => {
    const loot = inGroup("loot");
    expect(loot.map((p) => p.category)).toEqual(["safe", "safe", "medcase"]);
    expect(loot.map((p) => p.name)).toEqual(["Safe", "Safe", "Medcase"]);
  });

  it("names locks by their key, falling back to the lock type", () => {
    const locks = inGroup("locks");
    expect(locks.map((p) => p.category)).toEqual(["door", "trunk", "door"]);
    expect(locks.map((p) => p.name)).toEqual(["Factory emergency exit key", "Locked trunk", "Lab key"]);
  });

  it("names loose loot after its first three items", () => {
    const loose = inGroup("lootLoose");
    expect(loose.map((p) => p.category)).toEqual(["item", "item", "item"]);
    expect(loose.map((p) => p.name)).toEqual(["Bolts, Screws, Nuts +1", "Bolts, Screws", "Loose loot"]);
  });

  it("maps hazards, switches and BTR stations", () => {
    expect(inGroup("hazards").map((p) => p.category)).toEqual(["sniper", "mortar"]);
    expect(inGroup("switches").map((p) => p.category)).toEqual(["switch"]);
    expect(inGroup("btr").map((p) => p.category)).toEqual(["stop"]);
  });

  it("maps stationary weapons into the guns group", () => {
    const guns = inGroup("guns");
    expect(guns.map((p) => p.category)).toEqual(["gun", "gun"]);
    expect(guns[0].name).toBe("NSV Utyos 12.7x108 heavy machine gun");
    expect(guns.map((p) => p.id)).toEqual(["guns/gun/0", "guns/gun/1"]);
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
      "spawns/cultist-priest/3",
      "spawns/rogue/4",
      "spawns/scav/5",
      "spawns/sniper/8",
      "spawns/scav/9",
    ]);
  });
});

describe("point details", () => {
  it("labels extracts by faction, names their switch and fee, and transits as transits", () => {
    expect(inGroup("extracts").map((p) => p.details)).toEqual([
      ["PMC extract"],
      ["Scav extract"],
      ["PMC & Scav extract", "Activated by switch: Basement switch", "Requires Roubles ×20,000"],
      ["coop extract", "Requires Ark key"],
      ["Transit", "Labs keycard required"],
    ]);
  });

  it("carries an extract's or hazard's footprint onto its point", () => {
    const basement = points.find((p) => p.id === "e3")!;
    expect(basement.outline).toEqual([[0, 0], [1, 0], [1, 1]]);
    expect(basement.top).toBe(12);
    expect(basement.bottom).toBe(4);
    expect(points.find((p) => p.id === "e1")).not.toHaveProperty("outline");
    const mortar = inGroup("hazards").find((p) => p.category === "mortar")!;
    expect(mortar.outline).toHaveLength(3);
    expect(mortar.details).toEqual(["Mortar zones"]);
  });

  it("labels spawns with their category label", () => {
    expect(inGroup("spawns").map((p) => p.details[0])).toEqual([
      "PMC",
      "Scav",
      "Boss",
      "Cultist Priest",
      "Rogues",
      "Scav",
      "Sniper Scav",
      "Scav",
    ]);
  });

  it("lists every loose loot item, not just the three in the name", () => {
    expect(inGroup("lootLoose").map((p) => p.details)).toEqual([
      ["Bolts", "Screws", "Nuts", "Nails"],
      ["Bolts", "Screws"],
      [],
    ]);
  });

  it("spells out lock types and labels the remaining groups", () => {
    expect(inGroup("locks").map((p) => p.details)).toEqual([["Door"], ["Car door or trunk"], ["Door", "Needs power"]]);
    expect(inGroup("loot").map((p) => p.details[0])).toEqual(["Container", "Container", "Container"]);
    expect(inGroup("hazards")[0].details).toEqual(["Sniper zones"]);
    expect(inGroup("switches")[0].details).toEqual(["Switch", "Unlocks Basement", "Locks Alarm switch"]);
    expect(inGroup("guns")[0].details).toEqual(["Stationary gun"]);
    expect(inGroup("btr")[0].details).toEqual(["BTR stop"]);
  });
});

describe("spawn labels", () => {
  it("names every spawn category tarkov.dev draws", () => {
    for (const key of [
      "spawns/pmc",
      "spawns/scav",
      "spawns/sniper",
      "spawns/boss",
      "spawns/cultist-priest",
      "spawns/rogue",
      "spawns/black-div",
      "spawns/af",
      "spawns/bloodhound",
      "guns/gun",
    ]) {
      expect(CATEGORY_LABELS[key]).toBeTruthy();
    }
    expect(CATEGORY_LABELS["spawns/sniper"]).toBe("Sniper Scav");
    expect(CATEGORY_LABELS["spawns/bloodhound"]).toBe("Bloodhounds");
    expect(CATEGORY_LABELS["guns/gun"]).toBe("Stationary guns");
    expect(GROUP_LABELS.guns).toBe("Stationary Guns");
    expect(GROUP_ORDER.indexOf("guns")).toBe(GROUP_ORDER.indexOf("switches") + 1);
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

describe("findItem", () => {
  const pt = (id: string, group: string, name: string, details: string[]) =>
    ({ id, group, category: "x", name, mapKey: "customs", x: 0, y: 0, z: 0, details }) as MapPoint;
  const pts = [
    pt("l1", "lootLoose", "Bolts, Screws", ["Bolts", "Screws"]),
    pt("l2", "lootLoose", "Salewa", ["Salewa"]),
    pt("k1", "locks", "Factory emergency exit key", ["Door"]),
    pt("c1", "loot", "Safe", ["Container"]),
    pt("g1", "guns", "AGS-30", ["Stationary gun"]),
  ];

  it("matches loose loot by item, locks by key name and guns by name, case-insensitively", () => {
    expect([...findItem(pts, "bolt")]).toEqual(["l1"]);
    expect([...findItem(pts, "EXIT KEY")]).toEqual(["k1"]);
    expect([...findItem(pts, "ags")]).toEqual(["g1"]);
  });

  it("needs at least two characters and never matches containers", () => {
    expect(findItem(pts, "s").size).toBe(0);
    expect(findItem(pts, "  ").size).toBe(0);
    expect(findItem(pts, "safe").size).toBe(0);
  });
});

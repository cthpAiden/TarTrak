import { describe, it, expect } from "vitest";
import { tr, toQuestData, JSON_FILES, JSON_TARKOV_DEV, type RawBundle } from "./jsonSource";
import { QUEST_SCHEMA_VERSION } from "./types";

const raw: RawBundle = {
  maps: {
    data: {
      maps: {
        m1: {
          id: "m1",
          name: "m1 Name",
          normalizedName: "factory",
          extracts: [{ id: "e1", name: "E8_yard", faction: "pmc", position: { x: 1, y: 2, z: 3 } }],
          transits: [{ id: "12", description: "FAC_TRANSIT_12_DESC", map: "m2", position: { x: 4, y: 5, z: 6 } }],
          spawns: [
            { position: { x: 7, y: 8, z: 9 }, sides: ["all"], categories: ["player"], zoneName: "z1" },
            { position: { x: 7, y: 8, z: 9 }, sides: ["savage"], categories: ["boss"], zoneName: "5c0a1ff6d174af02a012e42b" },
          ],
          lootContainers: [{ lootContainer: "lc1", position: { x: 10, y: 11, z: 12 } }],
          lootLoose: [{ position: { x: 13, y: 14, z: 15 }, items: ["i1", "i2", "i1", "i9"] }],
          locks: [
            { id: "l1", lockType: "door", key: "k1", position: { x: 16, y: 17, z: 18 } },
            { id: "l2", lockType: "trunk", position: { x: 19, y: 20, z: 21 } },
          ],
          hazards: [{ id: "h1", hazardType: "sniper", name: "ScavRole/Marksman", position: { x: 22, y: 23, z: 24 } }],
          switches: [{ id: "sw1", name: "ZB013_switch", position: { x: 25, y: 26, z: 27 } }],
          btrStops: [{ name: "Taxi/p5/Name", x: 28, y: 29, z: 30 }],
          bosses: [
            {
              mob: "bossTagilla",
              spawnChance: 0.35,
              spawnLocations: [
                { name: "BotZone", chance: 1, spawnKey: "BotZone" },
                { name: "BotZone", chance: 1, spawnKey: "BotZone" },
                { name: "Gate", chance: 0.5, spawnKey: "ZoneGate" },
              ],
            },
            { mob: "ghost", spawnChance: 0.1, spawnLocations: [] },
          ],
          stationaryWeapons: [
            { stationaryWeapon: "gun1", position: { x: 31, y: 32, z: 33 } },
            { stationaryWeapon: "gun2", position: null },
            { stationaryWeapon: "gun3", position: { x: 34, y: 35, z: 36 } },
          ],
        },
        m2: { id: "m2", name: "m2 Name", normalizedName: "woods" },
      },
      lootContainers: { lc1: { id: "lc1", name: "lc1 Name", normalizedName: "weapon-box" } },
      mobs: { bossTagilla: { id: "bossTagilla", name: "bossTagilla", normalizedName: "tagilla" } },
    },
  },
  mapsEn: {
    data: {
      "m1 Name": "Factory",
      "m2 Name": "",
      E8_yard: "Courtyard",
      ZB013_switch: "ZB-013 Power Switch",
      bossTagilla: "Tagilla",
      "gun2 Name": "AGS-30 30x29mm automatic grenade launcher",
      FAC_TRANSIT_12_DESC: "Transit to Woods",
      "ScavRole/Marksman": "Sniper",
      "lc1 Name": "Weapon box",
      "Taxi/p5/Name": "Sawmill",
    },
  },
  tasks: {
    data: {
      tasks: {
        t1: {
          id: "t1",
          name: "t1 name",
          trader: "tr1",
          minPlayerLevel: 5,
          map: "m1",
          objectives: [
            {
              id: "o1",
              type: "visit",
              description: "o1 desc",
              zones: [
                { id: "z1", map: "m1", position: { x: 1, y: 2, z: 3 } },
                { id: "z2", map: "m2", position: { x: 4, y: 5, z: 6 } },
                { id: "z3", map: "m1", position: { x: 7, y: 8, z: 9 } },
              ],
            },
            { id: "o2", type: "findItem", description: "o2 desc" },
          ],
        },
        t2: { id: "t2", name: "t2 name", trader: "tr2", map: null, objectives: [{ id: "o3", type: "shoot", description: "o3 desc" }] },
      },
    },
  },
  tasksEn: { data: { "t1 name": "Debut", "o1 desc": "Visit the medical camp", "o2 desc": "", "t2 name": "Checking" } },
  traders: { data: { tr1: { id: "tr1", name: "tr1 Nickname", normalizedName: "prapor" } } },
  tradersEn: { data: { "tr1 Nickname": "Prapor" } },
  itemsEn: {
    data: {
      "k1 Name": "Factory emergency exit key",
      "i1 Name": "Bolts",
      "i2 Name": "Screws",
      "gun1 Name": "NSV Utyos 12.7x108 heavy machine gun",
    },
  },
};

describe("tr", () => {
  it("returns the translation when it is a non-empty string, else the key", () => {
    expect(tr({ a: "Alpha" }, "a")).toBe("Alpha");
    expect(tr({ a: "" }, "a")).toBe("a");
    expect(tr({}, "b")).toBe("b");
    expect(tr({ c: 3 } as Record<string, unknown>, "c")).toBe("c");
  });
});

describe("JSON_FILES", () => {
  it("names the seven source files", () => {
    expect(JSON_FILES).toEqual(["maps", "maps_en", "tasks", "tasks_en", "traders", "traders_en", "items_en"]);
    expect(JSON_TARKOV_DEV).toBe("https://json.tarkov.dev/regular");
  });
});

describe("toQuestData", () => {
  const d = toQuestData(raw, 1234);

  it("stamps the schema version and fetch time", () => {
    expect(d.schemaVersion).toBe(QUEST_SCHEMA_VERSION);
    expect(d.fetchedAt).toBe(1234);
  });

  it("throws when a required shape is missing", () => {
    expect(() => toQuestData({ ...raw, maps: { data: {} } }, 1)).toThrow(/maps\.data\.maps/);
    expect(() => toQuestData({ ...raw, tasks: { data: {} } }, 1)).toThrow(/tasks\.data\.tasks/);
  });

  it("translates task names, trader names and objective descriptions", () => {
    const [t1, t2] = d.tasks;
    expect(t1.name).toBe("Debut");
    expect(t1.trader.name).toBe("Prapor");
    expect(t1.minPlayerLevel).toBe(5);
    expect(t1.objectives[0].description).toBe("Visit the medical camp");
    // Missing translation falls back to the key.
    expect(t1.objectives[1].description).toBe("o2 desc");
    // Unknown trader falls back to the id.
    expect(t2.trader.name).toBe("tr2");
    expect(t2.minPlayerLevel).toBe(0);
  });

  it("derives objective maps from zones, then the task map", () => {
    const [t1, t2] = d.tasks;
    expect(t1.objectives[0].maps).toEqual([{ id: "m1" }, { id: "m2" }]);
    expect(t1.objectives[0].zones).toEqual([
      { id: "z1", map: { id: "m1" }, position: { x: 1, y: 2, z: 3 } },
      { id: "z2", map: { id: "m2" }, position: { x: 4, y: 5, z: 6 } },
      { id: "z3", map: { id: "m1" }, position: { x: 7, y: 8, z: 9 } },
    ]);
    expect(t1.objectives[1].maps).toEqual([{ id: "m1" }]);
    expect(t1.objectives[1].zones).toEqual([]);
    expect(t2.objectives[0].maps).toEqual([]);
  });

  it("maps every layer of a map", () => {
    const m = d.maps[0];
    expect(m.name).toBe("Factory");
    expect(m.normalizedName).toBe("factory");
    expect(m.extracts).toEqual([{ id: "e1", name: "Courtyard", faction: "pmc", position: { x: 1, y: 2, z: 3 } }]);
    expect(m.transits).toEqual([{ id: "12", description: "Transit to Woods", position: { x: 4, y: 5, z: 6 } }]);
    expect(m.spawns).toEqual([
      { zoneName: "z1", position: { x: 7, y: 8, z: 9 }, sides: ["all"], categories: ["player"] },
      { zoneName: "5c0a1ff6d174af02a012e42b", position: { x: 7, y: 8, z: 9 }, sides: ["savage"], categories: ["boss"] },
    ]);
    expect(m.lootContainers).toEqual([
      { lootContainer: { id: "lc1", name: "Weapon box", normalizedName: "weapon-box" }, position: { x: 10, y: 11, z: 12 } },
    ]);
    expect(m.lootLoose).toEqual([{ position: { x: 13, y: 14, z: 15 }, items: ["Bolts", "Screws", "i9"] }]);
    expect(m.locks).toEqual([
      { lockType: "door", key: "Factory emergency exit key", position: { x: 16, y: 17, z: 18 } },
      { lockType: "trunk", key: null, position: { x: 19, y: 20, z: 21 } },
    ]);
    expect(m.hazards).toEqual([{ hazardType: "sniper", name: "Sniper", position: { x: 22, y: 23, z: 24 } }]);
    expect(m.switches).toEqual([{ id: "sw1", name: "ZB-013 Power Switch", position: { x: 25, y: 26, z: 27 } }]);
    expect(m.btrStations).toEqual([{ id: "Taxi/p5/Name", name: "Sawmill", position: { x: 28, y: 29, z: 30 } }]);
  });

  it("maps bosses through the mobs table and falls back for an unknown mob", () => {
    expect(d.maps[0].bosses).toEqual([
      { name: "Tagilla", normalizedName: "tagilla", spawnChance: 0.35, spawnKeys: ["BotZone", "ZoneGate"] },
      { name: "ghost", normalizedName: "ghost", spawnChance: 0.1, spawnKeys: [] },
    ]);
  });

  it("names stationary weapons from items_en, then maps_en, then the id", () => {
    expect(d.maps[0].stationaryWeapons).toEqual([
      { id: "gun1", name: "NSV Utyos 12.7x108 heavy machine gun", position: { x: 31, y: 32, z: 33 } },
      { id: "gun2", name: "AGS-30 30x29mm automatic grenade launcher", position: null },
      { id: "gun3", name: "gun3", position: { x: 34, y: 35, z: 36 } },
    ]);
  });

  it("gives a map with no layer arrays empty ones and falls back to the name key", () => {
    const m = d.maps[1];
    expect(m.name).toBe("m2 Name");
    expect(m.extracts).toEqual([]);
    expect(m.lootLoose).toEqual([]);
    expect(m.btrStations).toEqual([]);
    expect(m.bosses).toEqual([]);
    expect(m.stationaryWeapons).toEqual([]);
  });
});

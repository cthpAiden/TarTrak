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
          raidDuration: 20,
          players: "7-8",
          accessKeys: ["k1", "k-unknown"],
          extracts: [
            { id: "e1", name: "E8_yard", faction: "pmc", position: { x: 1, y: 2, z: 3 } },
            {
              id: "e2",
              name: "Saferoom",
              faction: "shared",
              position: { x: 2, y: 3, z: 4 },
              switches: ["sw1", "sw-unknown"],
              transferItem: { item: "i1", count: 20000 },
              outline: [{ x: 0, y: 3, z: 0 }, { x: 4, y: 3, z: 0 }, { x: 4, y: 3, z: 4 }],
              top: 6,
              bottom: 1,
            },
          ],
          artillery: { zones: [{ id: "13", position: { x: 149, y: 2, z: -122 }, outline: [{ x: 1, y: 2, z: 1 }, { x: 2, y: 2, z: 1 }, { x: 2, y: 2, z: 2 }], top: 7, botom: -3 }] },
          transits: [
            { id: "12", description: "FAC_TRANSIT_12_DESC", map: "m2", position: { x: 4, y: 5, z: 6 }, conditions: "FAC_TRANSIT_12_COND" },
          ],
          spawns: [
            { position: { x: 7, y: 8, z: 9 }, sides: ["all"], categories: ["player"], zoneName: "z1" },
            { position: { x: 7, y: 8, z: 9 }, sides: ["savage"], categories: ["boss"], zoneName: "5c0a1ff6d174af02a012e42b" },
          ],
          lootContainers: [{ lootContainer: "lc1", position: { x: 10, y: 11, z: 12 } }],
          lootLoose: [
            { position: { x: 13, y: 14, z: 15 }, items: ["i1", "i2", "i1", "i9"] },
            { position: { x: 16, y: 14, z: 15 }, items: ["i2"] },
          ],
          locks: [
            { id: "l1", lockType: "door", key: "k1", position: { x: 16, y: 17, z: 18 } },
            { id: "l2", lockType: "trunk", position: { x: 19, y: 20, z: 21 } },
            { id: "l3", lockType: "door", key: "k1", needsPower: true, position: { x: 1, y: 1, z: 1 } },
          ],
          hazards: [{ id: "h1", hazardType: "sniper", name: "ScavRole/Marksman", position: { x: 22, y: 23, z: 24 } }],
          switches: [
            {
              id: "sw1",
              name: "ZB013_switch",
              position: { x: 25, y: 26, z: 27 },
              activates: [
                { operation: "Unlock", extract: "e2" },
                { operation: "Lock", switch: "sw2" },
                { operation: "Unlock", extract: "gone" },
              ],
            },
            { id: "sw2", name: "sw2 name", position: { x: 1, y: 2, z: 3 }, activates: [] },
          ],
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
              escorts: [
                { mob: "followerBully", amount: [{ chance: 1, count: 2 }, { chance: 0.5, count: 4 }] },
                { mob: "sniper", amount: [{ chance: 1, count: 1 }] },
              ],
              spawnTrigger: "Switch",
            },
            { mob: "ghost", spawnChance: 0.1, spawnLocations: [], escorts: [], spawnTrigger: null },
            { mob: "evil", spawnChance: 0.5, spawnLocations: [] },
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
      mobs: {
        bossTagilla: { id: "bossTagilla", name: "bossTagilla", normalizedName: "tagilla", imagePortraitLink: "https://assets.tarkov.dev/tagilla-portrait.png" },
        evil: { id: "evil", name: "evil", normalizedName: "evil", imagePortraitLink: "http://evil.example/portrait.png" },
      },
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
      FAC_TRANSIT_12_COND: "Labs keycard required",
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
          kappaRequired: true,
          lightkeeperRequired: false,
          factionName: "USEC",
          experience: 3000,
          finishRewards: {
            items: [{ item: "i1", count: 80000 }, { item: "i2" }, { count: 3 }],
            traderStanding: [{ trader: "tr1", standing: 0.1 }, { trader: "tr-unknown", standing: -0.02 }],
            skillLevelReward: [{ skill: "Surgery", level: 2 }],
            offerUnlock: [{ id: "of1" }, { id: "of2" }],
            craftUnlock: [{ id: "cr1" }],
          },
          traderRequirements: [
            { requirementType: "level", trader: "tr1", value: 2 },
            { requirementType: "reputation", trader: "tr1", value: 0.5 },
          ],
          failConditions: [
            { type: "taskStatus", task: "t2", status: ["complete"] },
            { type: "taskStatus", task: "t2", status: ["started"] },
            { type: "shoot", description: "fc desc" },
            { type: "shoot", description: "fc-untranslated" },
          ],
          wikiLink: "https://escapefromtarkov.fandom.com/wiki/Debut",
          neededKeys: [{ map: "m1", keys: ["k1", "k1"] }, { map: "m2", keys: ["k-unknown"] }],
          taskRequirements: [
            { task: "t0", status: ["complete"] },
            { task: "t9", status: ["started"] },
            { task: 7, status: ["complete"] },
          ],
          objectives: [
            {
              id: "o1",
              type: "visit",
              description: "o1 desc",
              maps: ["m1"],
              zones: [
                {
                  id: "z1",
                  map: "m1",
                  position: { x: 1, y: 2, z: 3 },
                  outline: [{ x: 0, y: 2, z: 0 }, { x: 2, y: 2, z: 0 }, { x: 2, y: 2, z: 6 }],
                  top: 5,
                  bottom: -1,
                },
                { id: "z2", map: "m2", position: { x: 4, y: 5, z: 6 } },
                { id: "z3", map: "m1", position: { x: 7, y: 8, z: 9 } },
              ],
            },
            { id: "o2", type: "findItem", description: "o2 desc", count: 3, foundInRaid: true, optional: true },
            {
              id: "o4",
              type: "findQuestItem",
              description: "o4 desc",
              questItem: "qi1",
              possibleLocations: [
                { map: "m1", positions: [{ x: 1, y: 2, z: 3 }, { x: 4, y: 5, z: 6 }] },
                { map: "m2", positions: [] },
              ],
            },
          ],
        },
        t2: { id: "t2", name: "t2 name", trader: "tr2", map: null, factionName: "Any", experience: 0, finishRewards: { items: [], traderStanding: [] }, objectives: [{ id: "o3", type: "shoot", description: "o3 desc", maps: ["m2", 5], count: null, foundInRaid: false, optional: false }] },
      },
      questItems: { qi1: { id: "qi1", name: "qi1 Name" } },
    },
  },
  tasksEn: {
    data: { "t1 name": "Debut", "o1 desc": "Visit the medical camp", "o2 desc": "", "t2 name": "Checking", "qi1 Name": "Secure folder 0013", "fc desc": "Die with the flare in your pockets" },
  },
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
    expect(t1.trader).toEqual({ id: "tr1", name: "Prapor" });
    expect(t1.minPlayerLevel).toBe(5);
    expect(t1.objectives[0].description).toBe("Visit the medical camp");
    // Missing translation falls back to the key.
    expect(t1.objectives[1].description).toBe("o2 desc");
    // Unknown trader falls back to the id.
    expect(t2.trader.name).toBe("tr2");
    expect(t2.minPlayerLevel).toBe(0);
  });

  it("keeps only complete-status prerequisites and the Kappa/Lightkeeper flags", () => {
    const [t1, t2] = d.tasks;
    expect(t1.requires).toEqual(["t0"]);
    expect(t1.kappaRequired).toBe(true);
    expect(t1.lightkeeperRequired).toBe(false);
    expect(t2.requires).toEqual([]);
    expect(t2.kappaRequired).toBe(false);
  });

  it("carries zone outlines as [x, z] pairs with their span, and only http(s) wiki links", () => {
    const [t1, t2] = d.tasks;
    const [z1, z2] = t1.objectives[0].zones!;
    expect(z1).toMatchObject({ outline: [[0, 0], [2, 0], [2, 6]], top: 5, bottom: -1 });
    expect(z2.outline).toBeUndefined();
    expect(t1.wikiLink).toBe("https://escapefromtarkov.fandom.com/wiki/Debut");
    expect(t2.wikiLink).toBeUndefined();
  });

  it("names the needed keys once each, falling back to the id", () => {
    const [t1, t2] = d.tasks;
    expect(t1.neededKeys).toEqual(["Factory emergency exit key", "k-unknown"]);
    expect(t2.neededKeys).toEqual([]);
  });

  it("derives objective maps from its own list, its zones and item spawns, then the task map", () => {
    const [t1, t2] = d.tasks;
    expect(t1.objectives[0].maps).toEqual([{ id: "m1" }, { id: "m2" }]);
    expect(t1.objectives[0].zones).toEqual([
      { id: "z1", map: { id: "m1" }, position: { x: 1, y: 2, z: 3 }, outline: [[0, 0], [2, 0], [2, 6]], top: 5, bottom: -1 },
      { id: "z2", map: { id: "m2" }, position: { x: 4, y: 5, z: 6 } },
      { id: "z3", map: { id: "m1" }, position: { x: 7, y: 8, z: 9 } },
    ]);
    expect(t1.objectives[1].maps).toEqual([{ id: "m1" }]);
    expect(t1.objectives[1].zones).toEqual([]);
    expect(t1.objectives[1].locations).toBeUndefined();
    expect(t2.objectives[0].maps).toEqual([{ id: "m2" }]);
  });

  it("keeps quest item spawn points per map, named, and counts their maps as the objective's", () => {
    const o4 = d.tasks[0].objectives[2];
    expect(o4.locations).toEqual([{ map: { id: "m1" }, positions: [{ x: 1, y: 2, z: 3 }, { x: 4, y: 5, z: 6 }] }]);
    expect(o4.questItem).toEqual({ id: "qi1", name: "Secure folder 0013" });
    expect(o4.maps).toEqual([{ id: "m1" }]);
  });

  it("maps every layer of a map", () => {
    const m = d.maps[0];
    expect(m.name).toBe("Factory");
    expect(m.normalizedName).toBe("factory");
    expect(m.extracts).toEqual([
      { id: "e1", name: "Courtyard", faction: "pmc", position: { x: 1, y: 2, z: 3 } },
      {
        id: "e2",
        name: "Saferoom",
        faction: "shared",
        position: { x: 2, y: 3, z: 4 },
        switches: ["ZB-013 Power Switch", "sw-unknown"],
        requiredItem: { name: "Bolts", count: 20000, image: "i1" },
        outline: [[0, 0], [4, 0], [4, 4]],
        top: 6,
        bottom: 1,
      },
    ]);
    expect(m.transits).toEqual([
      { id: "12", description: "Transit to Woods", position: { x: 4, y: 5, z: 6 }, conditions: "Labs keycard required" },
    ]);
    expect(m.spawns).toEqual([
      { zoneName: "z1", position: { x: 7, y: 8, z: 9 }, sides: ["all"], categories: ["player"] },
      { zoneName: "5c0a1ff6d174af02a012e42b", position: { x: 7, y: 8, z: 9 }, sides: ["savage"], categories: ["boss"] },
    ]);
    expect(m.lootContainers).toEqual([
      { lootContainer: { id: "lc1", name: "Weapon box", normalizedName: "weapon-box" }, position: { x: 10, y: 11, z: 12 } },
    ]);
    // A single-item spot carries the item's picture id; a lock its key's; both fall back to the item's own id.
    expect(m.lootLoose).toEqual([
      { position: { x: 13, y: 14, z: 15 }, items: ["Bolts", "Screws", "i9"] },
      { position: { x: 16, y: 14, z: 15 }, items: ["Screws"], image: "i2" },
    ]);
    expect(m.locks).toEqual([
      { lockType: "door", key: "Factory emergency exit key", position: { x: 16, y: 17, z: 18 }, keyImage: "k1" },
      { lockType: "trunk", key: null, position: { x: 19, y: 20, z: 21 } },
      { lockType: "door", key: "Factory emergency exit key", position: { x: 1, y: 1, z: 1 }, needsPower: true, keyImage: "k1" },
    ]);
    expect(m.hazards).toEqual([
      { hazardType: "sniper", name: "Sniper", position: { x: 22, y: 23, z: 24 } },
      { hazardType: "mortar", name: "Mortar", position: { x: 149, y: 2, z: -122 }, outline: [[1, 1], [2, 1], [2, 2]], top: 7, bottom: -3 },
    ]);
    expect(m.switches).toEqual([
      {
        id: "sw1",
        name: "ZB-013 Power Switch",
        position: { x: 25, y: 26, z: 27 },
        // An activation whose target is unknown is dropped rather than shown as an id.
        activates: [
          { operation: "Unlock", target: "Saferoom" },
          { operation: "Lock", target: "sw2 name" },
        ],
      },
      { id: "sw2", name: "sw2 name", position: { x: 1, y: 2, z: 3 } },
    ]);
    expect(m.btrStations).toEqual([{ id: "Taxi/p5/Name", name: "Sawmill", position: { x: 28, y: 29, z: 30 } }]);
  });

  it("maps bosses through the mobs table and falls back for an unknown mob", () => {
    expect(d.maps[0].bosses).toEqual([
      // Escorts: the largest count of each guard type, summed. Only tarkov.dev's own host may serve a portrait.
      { name: "Tagilla", normalizedName: "tagilla", spawnChance: 0.35, spawnKeys: ["BotZone", "ZoneGate"], escorts: 5, trigger: "Switch", portrait: "https://assets.tarkov.dev/tagilla-portrait.png" },
      { name: "ghost", normalizedName: "ghost", spawnChance: 0.1, spawnKeys: [] },
      { name: "evil", normalizedName: "evil", spawnChance: 0.5, spawnKeys: [] },
    ]);
  });

  it("carries the raid length, player count and access keys of a map, and leaves them off a map without", () => {
    // A key the item list cannot name is left off rather than shown as an id.
    expect(d.maps[0]).toMatchObject({ raidDuration: 20, players: "7-8", accessKeys: ["Factory emergency exit key"] });
    expect(d.maps[1].raidDuration).toBeUndefined();
    expect(d.maps[1].players).toBeUndefined();
    expect(d.maps[1].accessKeys).toBeUndefined();
  });

  it("keeps the faction, experience, rewards, trader level gates and fail conditions of a task", () => {
    const [t1, t2] = d.tasks;
    expect(t1.faction).toBe("USEC");
    expect(t1.experience).toBe(3000);
    expect(t1.rewards).toEqual({
      items: [{ name: "Bolts", count: 80000 }, { name: "Screws", count: 1 }],
      standing: [{ trader: "Prapor", delta: 0.1 }, { trader: "tr-unknown", delta: -0.02 }],
      skills: [{ name: "Surgery", level: 2 }],
      offers: 2,
      crafts: 1,
    });
    // Reputation gates are not shown; a "started" status does not fail anything; an untranslated condition is dropped.
    expect(t1.traderLevels).toEqual([{ trader: "Prapor", level: 2 }]);
    expect(t1.failsOn).toEqual(["Checking", "Die with the flare in your pockets"]);
    // "Any" is everyone's, an empty reward set is no reward set.
    expect(t2.faction).toBeUndefined();
    expect(t2.experience).toBeUndefined();
    expect(t2.rewards).toBeUndefined();
    expect(t2.traderLevels).toBeUndefined();
    expect(t2.failsOn).toBeUndefined();
  });

  it("keeps an objective's count, found-in-raid and optional flags only when set", () => {
    const [t1, t2] = d.tasks;
    expect(t1.objectives[1]).toMatchObject({ count: 3, foundInRaid: true, optional: true });
    expect(t1.objectives[0].count).toBeUndefined();
    expect(t2.objectives[0].count).toBeUndefined();
    expect(t2.objectives[0].foundInRaid).toBeUndefined();
    expect(t2.objectives[0].optional).toBeUndefined();
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

import { describe, it, expect } from "vitest";
import { compactQuestData } from "./compact";
import { QUEST_SCHEMA_VERSION, type MapInfo, type QuestData, type QuestTask } from "./types";

function task(id: string, over: Partial<QuestTask> = {}): QuestTask {
  return {
    id,
    name: id,
    trader: { id: "prapor", name: "Prapor" },
    minPlayerLevel: 1,
    objectives: [{ id: `${id}-o`, type: "giveItem", description: "d", maps: [{ id: "customs" }] }],
    ...over,
  };
}

function map(id: string, over: Partial<MapInfo> = {}): MapInfo {
  return { id, name: id, normalizedName: id, extracts: [], ...over };
}

function questData(over: Partial<QuestData> = {}): QuestData {
  return { schemaVersion: QUEST_SCHEMA_VERSION, tasks: [], maps: [], fetchedAt: 1, ...over };
}

describe("compactQuestData", () => {
  // String identity cannot be observed from JavaScript (toBe compares primitives by value), so the
  // interning of strings is pinned only through the value checks below; the shared container objects
  // and the unshared arrays are the observable half.
  it("keeps every value, including task strings, while leaving each task its own trader object", () => {
    const data = questData({ tasks: [task("t1"), task("t2")] });
    const before = structuredClone(data);

    compactQuestData(data);

    const [t1, t2] = data.tasks;
    expect(t1.trader).not.toBe(t2.trader);
    expect(data).toEqual(before);
  });

  it("shares one lootContainer object for entries with the same id, across maps, but not across different ids", () => {
    const c1 = { lootContainer: { id: "cont-1", name: "Drawer", normalizedName: "drawer" }, position: null };
    const c2 = { lootContainer: { id: "cont-1", name: "Drawer", normalizedName: "drawer" }, position: null };
    const c3 = { lootContainer: { id: "cont-2", name: "Jacket", normalizedName: "jacket" }, position: null };
    const data = questData({
      maps: [map("customs", { lootContainers: [c1, c3] }), map("factory", { lootContainers: [c2] })],
    });

    compactQuestData(data);

    expect(c1.lootContainer).toBe(c2.lootContainer);
    expect(c1.lootContainer).not.toBe(c3.lootContainer);
  });

  it("keeps each spot's array its own even though the strings inside are shared", () => {
    const spotA = { position: null, items: ["Bolts"] };
    const spotB = { position: null, items: ["Bolts"] };
    const data = questData({ maps: [map("customs", { lootLoose: [spotA, spotB] })] });

    compactQuestData(data);
    spotA.items.push("Screws");

    expect(spotA.items).not.toBe(spotB.items);
    expect(spotB.items).toEqual(["Bolts"]);
  });

  it("does not change the data, only shares identity", () => {
    const data = questData({
      tasks: [task("t1")],
      maps: [
        map("customs", {
          lootLoose: [{ position: { x: 0, y: 0, z: 0 }, items: ["Bolts", "Bolts"], categories: ["meds"], image: "img1" }],
          lootContainers: [{ lootContainer: { id: "c1", name: "Drawer", normalizedName: "drawer" }, position: null }],
          spawns: [{ zoneName: "Zone1", position: null, sides: ["pmc"], categories: ["boss"] }],
          hazards: [{ hazardType: "sniper", name: "Snipe", position: null }],
          locks: [{ lockType: "door", key: "Key1", position: null, keyImage: "img2" }],
          extracts: [{ id: "e1", name: "Extract1", faction: "pmc", position: null }],
        }),
      ],
    });
    const before = structuredClone(data);

    compactQuestData(data);

    expect(JSON.stringify(data)).toBe(JSON.stringify(before));
  });

  it("tolerates missing optional arrays and a map with no loot", () => {
    const bare: MapInfo = { id: "shoreline", name: "Shoreline", normalizedName: "shoreline", extracts: [] };
    const withNulls = map("woods", { lootLoose: null, lootContainers: null, spawns: null, hazards: null, locks: null });
    const data = questData({ maps: [bare, withNulls] });

    expect(() => compactQuestData(data)).not.toThrow();
  });

  it("tolerates null zoneName/key and missing image/categories/keyImage", () => {
    const data = questData({
      maps: [
        map("customs", {
          lootLoose: [{ position: null, items: ["Bolts"] }],
          spawns: [{ zoneName: null, position: null, sides: [], categories: [] }],
          locks: [{ lockType: "door", key: null, position: null }],
        }),
      ],
    });

    expect(() => compactQuestData(data)).not.toThrow();
    expect(data.maps[0].spawns?.[0].zoneName).toBeNull();
    expect(data.maps[0].locks?.[0].key).toBeNull();
  });

  it("returns the same object it was given", () => {
    const data = questData();
    expect(compactQuestData(data)).toBe(data);
  });
});

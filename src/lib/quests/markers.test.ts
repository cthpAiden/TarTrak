import { describe, it, expect } from "vitest";
import { extractQuestMarkers } from "./markers";
import { QUEST_SCHEMA_VERSION, type QuestData } from "./types";

const data: QuestData = {
  schemaVersion: QUEST_SCHEMA_VERSION,
  fetchedAt: 1,
  maps: [
    {
      id: "m-customs",
      name: "Customs",
      normalizedName: "customs",
      extracts: [
        { id: "e1", name: "ZB-1011", faction: "pmc", position: { x: 1, y: 2, z: 3 } },
        { id: "e2", name: "Scav only", faction: "scav", position: { x: 4, y: 5, z: 6 } },
        { id: "e3", name: "Shared", faction: "shared", position: { x: 7, y: 8, z: 9 } },
        { id: "e4", name: "No pos", faction: "pmc", position: null },
      ],
    },
    { id: "m-woods", name: "Woods", normalizedName: "woods", extracts: [] },
  ],
  tasks: [
    {
      id: "t1",
      name: "Debut",
      trader: { name: "Prapor" },
      minPlayerLevel: 1,
      objectives: [
        {
          id: "o1",
          type: "visit",
          description: "Locate the bunker",
          maps: [{ id: "m-customs" }],
          zones: [
            {
              id: "z1",
              map: { id: "m-customs" },
              position: { x: 10, y: 0, z: 20 },
              outline: [[5, 15], [15, 15], [15, 25], [5, 25]],
              top: 3,
              bottom: -3,
            },
            { id: "z2", map: { id: "m-woods" }, position: { x: 30, y: 0, z: 40 } },
          ],
        },
        { id: "o2", type: "shoot", description: "Kill 5 scavs", maps: [{ id: "m-customs" }] },
        {
          id: "o3",
          type: "findQuestItem",
          description: "Find the key",
          maps: [],
          zones: [{ id: "z3", map: { id: "m-unknown" }, position: { x: 1, y: 1, z: 1 } }],
        },
        {
          id: "o4",
          type: "findQuestItem",
          description: "Find the watch",
          maps: [{ id: "m-customs" }],
          questItem: { id: "qi1", name: "Bronze pocket watch" },
          locations: [
            { map: { id: "m-customs" }, positions: [{ x: 1, y: 2, z: 3 }, { x: 4, y: 5, z: 6 }] },
            { map: { id: "m-unknown" }, positions: [{ x: 9, y: 9, z: 9 }] },
          ],
        },
      ],
    },
  ],
};

describe("extractQuestMarkers", () => {
  it("creates one marker per zone with task metadata and resolved map key", () => {
    const ms = extractQuestMarkers(data);
    expect(ms).toHaveLength(4);
    expect(ms[0]).toEqual({
      id: "z1",
      taskId: "t1",
      taskName: "Debut",
      trader: "Prapor",
      minLevel: 1,
      objectiveType: "visit",
      category: "visit",
      description: "Locate the bunker",
      mapKey: "customs",
      x: 10,
      y: 0,
      z: 20,
      outline: [[5, 15], [15, 15], [15, 25], [5, 25]],
      top: 3,
      bottom: -3,
    });
    expect(ms[1].mapKey).toBe("woods");
    // No span from the data: the marker's own height stands in for both ends.
    expect(ms[1]).toMatchObject({ outline: undefined, top: 0, bottom: 0 });
  });

  it("skips objectives without zones and zones on unknown maps", () => {
    const ids = extractQuestMarkers(data).map((m) => m.id);
    expect(ids).not.toContain("z3");
  });

  it("draws one marker per quest item spawn point on a known map, named after the item", () => {
    const items = extractQuestMarkers(data).filter((m) => m.itemName);
    expect(items.map((m) => [m.id, m.x, m.z, m.top])).toEqual([
      ["o4/m-customs/0", 1, 3, 2],
      ["o4/m-customs/1", 4, 6, 5],
    ]);
    expect(items[0]).toMatchObject({ taskName: "Debut", category: "questItem", itemName: "Bronze pocket watch", description: "Find the watch" });
  });

  it("sets the filter category from the objective type", () => {
    expect(extractQuestMarkers(data).map((m) => m.category)).toEqual(["visit", "visit", "questItem", "questItem"]);
  });
});

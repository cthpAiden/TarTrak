import { describe, it, expect } from "vitest";
import { extractQuestMarkers, extractExtracts } from "./markers";
import type { QuestData } from "./types";

const data: QuestData = {
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
            { id: "z1", map: { id: "m-customs" }, position: { x: 10, y: 0, z: 20 } },
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
      ],
    },
  ],
};

describe("extractQuestMarkers", () => {
  it("creates one marker per zone with task metadata and resolved map key", () => {
    const ms = extractQuestMarkers(data);
    expect(ms).toHaveLength(2);
    expect(ms[0]).toEqual({
      id: "z1",
      taskId: "t1",
      taskName: "Debut",
      trader: "Prapor",
      minLevel: 1,
      objectiveType: "visit",
      description: "Locate the bunker",
      mapKey: "customs",
      x: 10,
      y: 0,
      z: 20,
    });
    expect(ms[1].mapKey).toBe("woods");
  });

  it("skips objectives without zones and zones on unknown maps", () => {
    const ids = extractQuestMarkers(data).map((m) => m.id);
    expect(ids).not.toContain("z3");
  });
});

describe("extractExtracts", () => {
  it("keeps pmc and shared extracts that have a position", () => {
    const ex = extractExtracts(data);
    expect(ex.map((e) => e.id)).toEqual(["e1", "e3"]);
    expect(ex[0]).toEqual({ id: "e1", name: "ZB-1011", mapKey: "customs", faction: "pmc", x: 1, y: 2, z: 3 });
  });
});

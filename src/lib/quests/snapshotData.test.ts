import { describe, it, expect } from "vitest";
import tasks from "../../../data/snapshot/tasks.json";
import maps from "../../../data/snapshot/maps.json";
import meta from "../../../data/snapshot/meta.json";
import { loadMapDefs, primaryMapKey } from "../map/mapsData";
import { extractQuestMarkers } from "./markers";
import { QUEST_SCHEMA_VERSION, type MapInfo, type QuestData, type QuestTask } from "./types";

// The bundled tarkov.dev snapshot, checked as a whole: every positioned objective must land on a map
// the app can show. A map tarkov.dev adds or renames would otherwise drop its quests silently.
const data: QuestData = { schemaVersion: QUEST_SCHEMA_VERSION, tasks: tasks as unknown as QuestTask[], maps: maps as unknown as MapInfo[], fetchedAt: meta.fetchedAt };
const markers = extractQuestMarkers(data);

describe("bundled snapshot", () => {
  it("is on the current schema", () => {
    expect(meta.schemaVersion).toBe(QUEST_SCHEMA_VERSION);
  });

  it("puts every zone and quest item spawn on a map the app has", () => {
    const keys = new Set(loadMapDefs().map((d) => d.key));
    const names = new Map(data.maps.map((m) => [m.id, m.normalizedName]));
    const unknown = new Set<string>();
    let expected = 0;
    for (const t of data.tasks) {
      for (const o of t.objectives) {
        const seen = new Set<string>();
        const add = (mapId: string, p: { x: number; y: number; z: number }) => {
          const key = primaryMapKey(names.get(mapId) ?? mapId);
          if (!keys.has(key)) unknown.add(key);
          seen.add(`${key}|${p.x}|${p.y}|${p.z}`);
        };
        for (const z of o.zones ?? []) add(z.map.id, z.position);
        for (const l of o.locations ?? []) for (const p of l.positions) add(l.map.id, p);
        expected += seen.size;
      }
    }
    expect([...unknown]).toEqual([]);
    expect(markers).toHaveLength(expected);
    expect(markers.every((m) => keys.has(m.mapKey))).toBe(true);
  });

  it("keeps the Cargo X laptop in the Shoreline resort east wing", () => {
    expect(markers.filter((m) => m.taskName === "Cargo X")).toEqual([
      expect.objectContaining({ mapKey: "shoreline", category: "questItem", itemName: "Toughbook reinforced laptop", x: -285.103027, y: 2.512, z: -89.3500061 }),
    ]);
  });

  it("shows objectives that tarkov.dev places only on Night Factory on Factory", () => {
    const ms = markers.filter((m) => m.taskName === "Health Care Privacy - Part 5");
    expect(ms.length).toBeGreaterThan(0);
    expect(ms.every((m) => m.mapKey === "factory")).toBe(true);
  });
});

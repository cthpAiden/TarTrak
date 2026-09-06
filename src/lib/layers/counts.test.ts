import { describe, it, expect } from "vitest";
import { buildCounts } from "./counts";
import type { MapPoint } from "./points";
import type { QuestMarker } from "../quests/markers";
import type { Filters } from "./filters";

function point(group: string, category: string, name = "P", i = 0): MapPoint {
  return {
    id: `${group}/${category}/${i}`,
    group: group as MapPoint["group"],
    category,
    name,
    mapKey: "customs",
    x: 0,
    y: 0,
    z: 0,
    details: [],
  };
}

function marker(category: QuestMarker["category"], i = 0): QuestMarker {
  return {
    id: `m${i}`,
    taskId: `t${i}`,
    taskName: "Task",
    trader: "Prapor",
    minLevel: 1,
    objectiveType: "visit",
    category,
    description: "",
    mapKey: "customs",
    x: 0,
    y: 0,
    z: 0,
    top: 0,
    bottom: 0,
  };
}

const noFilters: Filters = {};

describe("buildCounts", () => {
  it("orders groups with labels first and quests third", () => {
    const groups = buildCounts([], [], noFilters, 7);
    expect(groups[0]).toMatchObject({ group: "labels", total: 7, shown: 7, state: "all" });
    expect(groups.map((g) => g.group)).toEqual([
      "labels",
      "extracts",
      "quests",
      "spawns",
      "loot",
      "lootLoose",
      "locks",
      "hazards",
      "switches",
      "guns",
      "btr",
    ]);
    expect(groups.map((g) => g.label)).toEqual([
      "Map Labels",
      "Extracts",
      "Map Tasks",
      "Spawns",
      "Containers",
      "Loose Loot",
      "Locks",
      "Hazards",
      "Switches",
      "Stationary Guns",
      "BTR",
    ]);
  });

  it("keeps groups with no points, with zero totals and no categories", () => {
    const groups = buildCounts([], [], noFilters);
    const locks = groups.find((g) => g.group === "locks")!;
    expect(locks.total).toBe(0);
    expect(locks.shown).toBe(0);
    expect(locks.categories).toEqual([]);
  });

  it("counts totals and shown per category from isOn", () => {
    const points = [
      point("extracts", "pmc", "Crossroads", 0),
      point("extracts", "pmc", "RUAF", 1),
      point("extracts", "scav", "Old Gas", 2),
    ];
    const groups = buildCounts(points, [], noFilters);
    const extracts = groups.find((g) => g.group === "extracts")!;
    // extracts/pmc is on by default, extracts/scav is not.
    expect(extracts.total).toBe(3);
    expect(extracts.shown).toBe(2);
    const pmc = extracts.categories.find((c) => c.key === "extracts/pmc")!;
    expect(pmc).toMatchObject({ group: "extracts", category: "pmc", label: "PMC Extracts", total: 2, shown: 2 });
    const scav = extracts.categories.find((c) => c.key === "extracts/scav")!;
    expect(scav).toMatchObject({ label: "SCAV Extracts", total: 1, shown: 0 });
    expect(extracts.state).toBe("some");
  });

  it("counts a loose loot spot in every category row its items fall in", () => {
    const both = { ...point("lootLoose", "barter-items", "Bolts, Keycard", 0), categories: ["barter-items", "keys"] };
    const groups = buildCounts([both, point("lootLoose", "keys", "Keycard", 1)], [], { "lootLoose/keys": true });
    const loose = groups.find((g) => g.group === "lootLoose")!;
    expect(loose.categories.map((c) => [c.category, c.total, c.shown])).toEqual([
      ["barter-items", 1, 0],
      ["keys", 2, 2],
    ]);
  });

  it("reports group state all and none", () => {
    const points = [point("locks", "door"), point("locks", "container", "Safe", 1)];
    const allOn = buildCounts(points, [], { "locks/door": true, "locks/container": true });
    expect(allOn.find((g) => g.group === "locks")!.state).toBe("all");
    expect(buildCounts(points, [], noFilters).find((g) => g.group === "locks")!.state).toBe("none");
  });

  it("always lists the five quest categories, whether or not markers exist", () => {
    const groups = buildCounts([], [marker("visit"), marker("mark", 1), marker("mark", 2)], noFilters);
    const quests = groups.find((g) => g.group === "quests")!;
    expect(quests.categories.map((c) => c.category)).toEqual(["visit", "questItem", "mark", "item", "other"]);
    expect(quests.categories.map((c) => c.label)).toEqual(["Visit", "Quest items", "Mark", "Items", "Other"]);
    expect(quests.categories.find((c) => c.category === "mark")!.total).toBe(2);
    expect(quests.categories.find((c) => c.category === "questItem")!.total).toBe(0);
    // Every quest category is on by default.
    expect(quests.total).toBe(3);
    expect(quests.shown).toBe(3);
    expect(quests.state).toBe("all");
  });

  it("excludes quest markers of a category that is turned off from shown", () => {
    const groups = buildCounts([], [marker("visit"), marker("mark", 1)], { "quests/mark": false });
    const quests = groups.find((g) => g.group === "quests")!;
    expect(quests.total).toBe(2);
    expect(quests.shown).toBe(1);
    expect(quests.state).toBe("some");
  });

  it("lists only the point categories present in the input, sorted by label", () => {
    const points = [point("loot", "weapon-box", "Weapon box"), point("loot", "ammo-box", "Ammo box", 1)];
    const loot = buildCounts(points, [], noFilters).find((g) => g.group === "loot")!;
    expect(loot.categories.map((c) => c.label)).toEqual(["Ammo box", "Weapon box"]);
    expect(loot.categories.map((c) => c.key)).toEqual(["loot/ammo-box", "loot/weapon-box"]);
  });
});

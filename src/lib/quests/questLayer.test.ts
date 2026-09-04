import { describe, it, expect } from "vitest";
import { iconFor, visibleQuestMarkers, questDivIcon } from "./questLayer";
import type { QuestMarker } from "./markers";

const mk = (id: string, over: Partial<QuestMarker> = {}): QuestMarker => ({
  id,
  taskId: `task-${id}`,
  taskName: `Task ${id}`,
  trader: "Prapor",
  minLevel: 1,
  objectiveType: "visit",
  description: "d",
  mapKey: "customs",
  x: 0,
  y: 0,
  z: 0,
  ...over,
});

describe("iconFor", () => {
  it.each([
    ["visit", "◎"],
    ["findItem", "▣"],
    ["giveItem", "▣"],
    ["plantItem", "▣"],
    ["findQuestItem", "★"],
    ["mark", "⚑"],
    ["shoot", "•"],
  ])("%s -> %s", (t, icon) => expect(iconFor(t)).toBe(icon));
});

describe("visibleQuestMarkers", () => {
  const all = [mk("a"), mk("b", { taskId: "done-task" }), mk("c", { mapKey: "woods" }), mk("d", { minLevel: 20 })];

  it("filters by map, done state and level", () => {
    const vis = visibleQuestMarkers(all, "customs", { "done-task": true }, 10);
    expect(vis.map((m) => m.id)).toEqual(["a"]);
  });

  it("level 0 disables the level filter", () => {
    const vis = visibleQuestMarkers(all, "customs", {}, 0);
    expect(vis.map((m) => m.id)).toEqual(["a", "b", "d"]);
  });
});

describe("questDivIcon", () => {
  it("renders the icon glyph and task name as title", () => {
    const icon = questDivIcon(mk("a", { objectiveType: "mark" }));
    expect(icon.options.html).toContain("⚑");
    expect(icon.options.className).toContain("quest-icon");
  });
});

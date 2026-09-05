import { describe, it, expect } from "vitest";
import { esc, questCategory, visibleQuestMarkers, questIcon, questIconFile } from "./questLayer";
import type { QuestMarker } from "./markers";

const mk = (id: string, over: Partial<QuestMarker> = {}): QuestMarker => ({
  id,
  taskId: `task-${id}`,
  taskName: `Task ${id}`,
  trader: "Prapor",
  minLevel: 1,
  objectiveType: "visit",
  category: "visit",
  description: "d",
  mapKey: "customs",
  x: 0,
  y: 0,
  z: 0,
  top: 0,
  bottom: 0,
  ...over,
});

describe("questIconFile", () => {
  it.each([
    ["visit", "quest_objective"],
    ["mark", "quest_objective"],
    ["other", "quest_objective"],
    ["questItem", "quest_item"],
    ["item", "quest_item"],
  ] as const)("%s -> %s", (c, file) => expect(questIconFile(c)).toBe(file));
});

describe("questCategory", () => {
  it.each([
    ["visit", "visit"],
    ["findQuestItem", "questItem"],
    ["mark", "mark"],
    ["findItem", "item"],
    ["giveItem", "item"],
    ["plantItem", "item"],
    ["plantQuestItem", "item"],
    ["giveQuestItem", "item"],
    ["buildWeapon", "item"],
    ["sellItem", "item"],
    ["shoot", "other"],
  ])("%s -> %s", (t, c) => expect(questCategory(t)).toBe(c));
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

describe("questIcon", () => {
  it("is a 24px image marker carrying the category as a class", () => {
    const icon = questIcon(mk("a", { objectiveType: "mark", category: "mark" }));
    expect(icon.options.iconUrl).toBe("/icons/quest_objective.png");
    expect(icon.options.iconSize).toEqual([24, 24]);
    expect(icon.options.className).toContain("quest-icon");
    expect(icon.options.className).toContain("mark");
  });
});

describe("esc", () => {
  it("turns every HTML-significant character into a numeric reference", () => {
    expect(esc(`&<>"'`)).toBe("&#38;&#60;&#62;&#34;&#39;");
  });

  it("leaves ordinary names alone", () => {
    expect(esc("ZB-1011")).toBe("ZB-1011");
  });
});

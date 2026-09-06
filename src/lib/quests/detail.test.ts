import { describe, it, expect } from "vitest";
import { gateLines, objectiveLine, rewardLine, spansMaps } from "./detail";
import type { QuestTask, TaskObjective } from "./types";

const obj = (over: Partial<TaskObjective> = {}): TaskObjective => ({ id: "o", type: "giveItem", description: "Hand over the items", maps: [], ...over });
const task = (over: Partial<QuestTask> = {}): QuestTask => ({ id: "t", name: "Debut", trader: { id: "p", name: "Prapor" }, minPlayerLevel: 1, objectives: [], ...over });

describe("objectiveLine", () => {
  it("appends the count, found-in-raid and optional flags tarkov.dev sets", () => {
    expect(objectiveLine(obj())).toBe("Hand over the items");
    expect(objectiveLine(obj({ count: 1 }))).toBe("Hand over the items");
    expect(objectiveLine(obj({ count: 2500, foundInRaid: true, optional: true }))).toBe("Hand over the items ×2,500 (found in raid) (optional)");
  });
});

describe("spansMaps", () => {
  it("is true only when the objectives sit on more than one map", () => {
    expect(spansMaps(task({ objectives: [obj({ maps: [{ id: "a" }] }), obj({ maps: [{ id: "a" }] })] }))).toBe(false);
    expect(spansMaps(task({ objectives: [obj({ maps: [{ id: "a" }] }), obj({ maps: [{ id: "b" }] })] }))).toBe(true);
    expect(spansMaps(task())).toBe(false);
  });
});

describe("gateLines", () => {
  const names: Record<string, string> = { t0: "Shortage", t1: "Checking" };
  it("names the prerequisites not done yet, trader levels and the faction limit", () => {
    const t = task({ requires: ["t0", "t1", "t-unknown"], traderLevels: [{ trader: "Prapor", level: 2 }], faction: "USEC" });
    expect(gateLines(t, { t1: true }, (id) => names[id])).toEqual(["after Shortage, t-unknown", "Prapor LL2", "USEC only"]);
  });
  it("is empty once every prerequisite is done and nothing else gates", () => {
    expect(gateLines(task({ requires: ["t0"] }), { t0: true }, (id) => names[id])).toEqual([]);
    expect(gateLines(task(), {}, () => undefined)).toEqual([]);
  });
});

describe("rewardLine", () => {
  it("lists experience, items, reputation, skills and unlock counts", () => {
    const t = task({
      experience: 3000,
      rewards: {
        items: [{ name: "Roubles", count: 80000 }, { name: "Salewa first aid kit", count: 1 }],
        standing: [{ trader: "Prapor", delta: 0.1 }, { trader: "Fence", delta: -0.02 }],
        skills: [{ name: "Surgery", level: 2 }],
        offers: 2,
        crafts: 1,
      },
    });
    expect(rewardLine(t)).toBe("+3,000 XP · Roubles ×80,000 · Salewa first aid kit · Prapor +0.10 · Fence −0.02 · Surgery +2 · 2 offers · 1 craft");
  });
  it("is empty for a task that pays nothing listed", () => {
    expect(rewardLine(task())).toBe("");
    expect(rewardLine(task({ rewards: {} }))).toBe("");
  });
});

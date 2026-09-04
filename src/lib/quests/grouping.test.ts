import { describe, it, expect } from "vitest";
import { groupByTrader, TRADER_ORDER, type GroupOpts } from "./grouping";
import type { QuestTask } from "./types";

function task(id: string, name: string, trader: string, minPlayerLevel = 1): QuestTask {
  return { id, name, trader: { name: trader }, minPlayerLevel, objectives: [] };
}

const opts = (over: Partial<GroupOpts> = {}): GroupOpts => ({
  search: "",
  hideDone: false,
  playerLevel: 0,
  done: {},
  countsOnMap: new Map(),
  ...over,
});

describe("groupByTrader", () => {
  it("orders traders by the fixed order, then unknown traders", () => {
    const tasks = [task("t1", "A", "Ref"), task("t2", "B", "Prapor"), task("t3", "C", "Zed"), task("t4", "D", "BTR Driver")];
    expect(groupByTrader(tasks, opts()).map((g) => g.trader)).toEqual(["Prapor", "Ref", "BTR Driver", "Zed"]);
    expect(TRADER_ORDER[0]).toBe("Prapor");
  });

  it("counts done and total across every task of the trader regardless of search", () => {
    const tasks = [task("t1", "Debut", "Prapor"), task("t2", "Checking", "Prapor")];
    const g = groupByTrader(tasks, opts({ search: "debut", done: { t2: true } }));
    expect(g).toHaveLength(1);
    expect(g[0].done).toBe(1);
    expect(g[0].total).toBe(2);
    expect(g[0].tasks.map((x) => x.t.id)).toEqual(["t1"]);
  });

  it("hideDone removes done tasks but keeps the counts", () => {
    const tasks = [task("t1", "Debut", "Prapor"), task("t2", "Checking", "Prapor")];
    const g = groupByTrader(tasks, opts({ hideDone: true, done: { t2: true } }));
    expect(g[0].tasks.map((x) => x.t.id)).toEqual(["t1"]);
    expect(g[0].done).toBe(1);
    expect(g[0].total).toBe(2);
  });

  it("filters by player level, with 0 meaning no limit", () => {
    const tasks = [task("t1", "Low", "Prapor", 1), task("t2", "High", "Prapor", 11)];
    expect(groupByTrader(tasks, opts({ playerLevel: 0 }))[0].tasks).toHaveLength(2);
    expect(groupByTrader(tasks, opts({ playerLevel: 10 }))[0].tasks.map((x) => x.t.id)).toEqual(["t1"]);
  });

  it("sorts by on-map count desc, then level asc, then name", () => {
    const tasks = [
      task("t1", "Zulu", "Prapor", 1),
      task("t2", "Alpha", "Prapor", 1),
      task("t3", "Bravo", "Prapor", 5),
      task("t4", "Onmap", "Prapor", 20),
    ];
    const g = groupByTrader(tasks, opts({ countsOnMap: new Map([["t4", 3]]) }));
    expect(g[0].tasks.map((x) => x.t.id)).toEqual(["t4", "t2", "t1", "t3"]);
    expect(g[0].tasks[0].count).toBe(3);
  });

  it("matches the trader name in search and omits empty groups", () => {
    const tasks = [task("t1", "Debut", "Prapor"), task("t2", "Shortage", "Therapist")];
    const g = groupByTrader(tasks, opts({ search: "thera" }));
    expect(g.map((x) => x.trader)).toEqual(["Therapist"]);
    expect(g[0].tasks.map((x) => x.t.id)).toEqual(["t2"]);
  });
});

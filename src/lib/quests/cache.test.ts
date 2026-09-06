import { describe, it, expect, vi } from "vitest";
import { isQuestData, loadQuestData, MAX_AGE_MS, type QuestLoaderDeps } from "./cache";
import { QUEST_SCHEMA_VERSION, type QuestData } from "./types";

const d = (fetchedAt: number, tag: string): QuestData => ({
  schemaVersion: QUEST_SCHEMA_VERSION,
  fetchedAt,
  tasks: [{ id: tag, name: tag, trader: { id: "t", name: "T" }, minPlayerLevel: 1, objectives: [] }],
  maps: [],
});

function deps(over: Partial<QuestLoaderDeps>): QuestLoaderDeps & { written: QuestData[] } {
  const written: QuestData[] = [];
  return {
    written,
    readCache: async () => null,
    writeCache: async (x) => {
      written.push(x);
    },
    fetchRemote: async () => {
      throw new Error("offline");
    },
    snapshot: () => null,
    now: () => 1_000_000_000_000,
    ...over,
  };
}

describe("loadQuestData", () => {
  it("uses a fresh cache and does not fetch", async () => {
    const fetchRemote = vi.fn(async () => d(0, "net"));
    const dp = deps({ readCache: async () => d(1_000_000_000_000 - 1000, "cache"), fetchRemote });
    const updates: string[] = [];
    await loadQuestData(dp, (data, src) => updates.push(`${src}:${data.tasks[0].id}`));
    expect(updates).toEqual(["cache:cache"]);
    expect(fetchRemote).not.toHaveBeenCalled();
  });

  it("serves a stale cache first, then refreshes from the network and writes the cache", async () => {
    const stale = d(1_000_000_000_000 - MAX_AGE_MS - 1, "stale");
    const dp = deps({ readCache: async () => stale, fetchRemote: async () => d(5, "net") });
    const updates: string[] = [];
    await loadQuestData(dp, (data, src) => updates.push(`${src}:${data.tasks[0].id}`));
    expect(updates).toEqual(["cache:stale", "network:net"]);
    expect(dp.written).toHaveLength(1);
    expect(dp.written[0].fetchedAt).toBe(1_000_000_000_000);
  });

  it("falls back to the snapshot when there is no cache and the network fails", async () => {
    const dp = deps({ snapshot: () => d(1, "snap") });
    const updates: string[] = [];
    await loadQuestData(dp, (data, src) => updates.push(`${src}:${data.tasks[0].id}`));
    expect(updates).toEqual(["snapshot:snap"]);
    expect(dp.written).toHaveLength(0);
  });

  it("awaits a lazily loaded snapshot and survives one that rejects", async () => {
    const dp = deps({ snapshot: async () => d(1, "snap") });
    const updates: string[] = [];
    await loadQuestData(dp, (data, src) => updates.push(`${src}:${data.tasks[0].id}`));
    expect(updates).toEqual(["snapshot:snap"]);
    const bad = deps({ snapshot: () => Promise.reject(new Error("no file")) });
    const none: string[] = [];
    await loadQuestData(bad, (data, src) => none.push(`${src}:${data.tasks[0].id}`));
    expect(none).toEqual([]);
  });

  it("fetches when there is no cache and prefers network over snapshot", async () => {
    const dp = deps({ snapshot: () => d(1, "snap"), fetchRemote: async () => d(2, "net") });
    const updates: string[] = [];
    await loadQuestData(dp, (data, src) => updates.push(`${src}:${data.tasks[0].id}`));
    expect(updates).toEqual(["snapshot:snap", "network:net"]);
  });

  it("calls nothing when no source has data", async () => {
    const dp = deps({});
    const onUpdate = vi.fn();
    await loadQuestData(dp, onUpdate);
    expect(onUpdate).not.toHaveBeenCalled();
  });
});

describe("isQuestData", () => {
  it("accepts a well-formed payload", () => {
    expect(isQuestData(d(1, "ok"))).toBe(true);
    expect(isQuestData({ schemaVersion: QUEST_SCHEMA_VERSION, tasks: [], maps: [], fetchedAt: 0 })).toBe(true);
  });

  it("rejects anything the app would choke on", () => {
    expect(isQuestData(null)).toBe(false);
    expect(isQuestData("{}")).toBe(false);
    expect(isQuestData({})).toBe(false);
    expect(isQuestData({ schemaVersion: QUEST_SCHEMA_VERSION, tasks: [], maps: [] })).toBe(false);
    expect(isQuestData({ schemaVersion: QUEST_SCHEMA_VERSION, tasks: [], maps: [], fetchedAt: "1" })).toBe(false);
    expect(isQuestData({ schemaVersion: QUEST_SCHEMA_VERSION, tasks: {}, maps: [], fetchedAt: 1 })).toBe(false);
    expect(isQuestData({ schemaVersion: QUEST_SCHEMA_VERSION, tasks: [], maps: null, fetchedAt: 1 })).toBe(false);
  });

  it("rejects data without the current schemaVersion", () => {
    expect(isQuestData({ tasks: [], maps: [], fetchedAt: 1 })).toBe(false);
    expect(isQuestData({ schemaVersion: 1, tasks: [], maps: [], fetchedAt: 1 })).toBe(false);
    expect(isQuestData({ schemaVersion: QUEST_SCHEMA_VERSION, tasks: [], maps: [], fetchedAt: 1 })).toBe(true);
  });
});

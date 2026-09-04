import { describe, it, expect, vi } from "vitest";
import { mergeSettings, loadSettings, DEFAULT_SETTINGS } from "./store";

vi.mock("@tauri-apps/plugin-store", () => ({
  load: () => Promise.reject(new Error("corrupt settings.json")),
}));

describe("mergeSettings", () => {
  it("returns defaults for garbage", () => {
    expect(mergeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(mergeSettings("x")).toEqual(DEFAULT_SETTINGS);
    expect(mergeSettings([])).toEqual(DEFAULT_SETTINGS);
  });

  it("keeps known keys with the right type and drops the rest", () => {
    const s = mergeSettings({ name: "Bob", playerLevel: "12", deleteScreenshots: false, bogus: 1, color: 7 });
    expect(s.name).toBe("Bob");
    expect(s.playerLevel).toBe(DEFAULT_SETTINGS.playerLevel);
    expect(s.deleteScreenshots).toBe(false);
    expect(s.color).toBe(DEFAULT_SETTINGS.color);
    expect((s as unknown as Record<string, unknown>).bogus).toBeUndefined();
  });

  it("allows null for nullable dirs and lastMap", () => {
    const s = mergeSettings({ screenshotsDir: null, logsDir: "D:\\x\\Logs", lastMap: null });
    expect(s.screenshotsDir).toBeNull();
    expect(s.logsDir).toBe("D:\\x\\Logs");
    expect(s.lastMap).toBeNull();
  });

  it("clamps an over-long name and color to 32 chars", () => {
    const s = mergeSettings({ name: "x".repeat(50), color: "#".repeat(40) });
    expect(s.name).toHaveLength(32);
    expect(s.color).toHaveLength(32);
  });

  it("clamps the heading line length to [8, 120]", () => {
    expect(mergeSettings({ lineLengthPx: 0 }).lineLengthPx).toBe(8);
    expect(mergeSettings({ lineLengthPx: 5000 }).lineLengthPx).toBe(120);
    expect(mergeSettings({ lineLengthPx: 40 }).lineLengthPx).toBe(40);
  });

  it("clamps the player level to [0, 79]", () => {
    expect(mergeSettings({ playerLevel: -5 }).playerLevel).toBe(0);
    expect(mergeSettings({ playerLevel: 300 }).playerLevel).toBe(79);
    expect(mergeSettings({ playerLevel: 42 }).playerLevel).toBe(42);
  });

  it("defaults layerFilters and hiddenQuests to empty objects", () => {
    expect(mergeSettings(undefined).layerFilters).toEqual({});
    expect(mergeSettings(undefined).hiddenQuests).toEqual({});
  });

  it("keeps valid layer filter keys", () => {
    const s = mergeSettings({ layerFilters: { loot: true, "loot/safe": false } });
    expect(s.layerFilters).toEqual({ loot: true, "loot/safe": false });
  });

  it("resets layerFilters that are not a flat boolean record with valid keys", () => {
    expect(mergeSettings({ layerFilters: { loot: "yes" } }).layerFilters).toEqual({});
    expect(mergeSettings({ layerFilters: [] }).layerFilters).toEqual({});
    expect(mergeSettings({ layerFilters: { "a/b/c": true } }).layerFilters).toEqual({});
  });

  it("truncates layerFilters to the first 500 keys", () => {
    const many: Record<string, boolean> = {};
    for (let i = 0; i < 501; i++) many[`g/k${i}`] = true;
    const kept = mergeSettings({ layerFilters: many }).layerFilters;
    expect(Object.keys(kept)).toHaveLength(500);
    expect(kept["g/k0"]).toBe(true);
    expect(kept["g/k499"]).toBe(true);
    expect(kept["g/k500"]).toBeUndefined();
  });

  it("keeps hiddenQuests of true, resets anything else, and truncates to 2000", () => {
    expect(mergeSettings({ hiddenQuests: { t1: true } }).hiddenQuests).toEqual({ t1: true });
    expect(mergeSettings({ hiddenQuests: { t1: false } }).hiddenQuests).toEqual({});
    expect(mergeSettings({ hiddenQuests: [] }).hiddenQuests).toEqual({});
    const many: Record<string, true> = {};
    for (let i = 0; i < 2001; i++) many[`t${i}`] = true;
    const kept = mergeSettings({ hiddenQuests: many }).hiddenQuests;
    expect(Object.keys(kept)).toHaveLength(2000);
    expect(kept["t0"]).toBe(true);
    expect(kept["t2000"]).toBeUndefined();
  });

  it("rejects a last room that is not a room code", () => {
    expect(mergeSettings({ lastRoom: "ABC123" }).lastRoom).toBe("ABC123");
    expect(mergeSettings({ lastRoom: "" }).lastRoom).toBe("");
    expect(mergeSettings({ lastRoom: "abc123" }).lastRoom).toBe("");
    expect(mergeSettings({ lastRoom: "ABC12" }).lastRoom).toBe("");
    expect(mergeSettings({ lastRoom: "ABC1234" }).lastRoom).toBe("");
    expect(mergeSettings({ lastRoom: "AB C12" }).lastRoom).toBe("");
  });
});

describe("loadSettings", () => {
  it("falls back to defaults when the store cannot be opened", async () => {
    await expect(loadSettings()).resolves.toEqual(DEFAULT_SETTINGS);
  });
});

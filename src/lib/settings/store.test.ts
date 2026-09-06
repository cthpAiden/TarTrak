import { describe, it, expect, vi } from "vitest";
import { mergeSettings, loadSettings, DEFAULT_SETTINGS, DEFAULT_RELAY_URL } from "./store";

vi.mock("@tauri-apps/plugin-store", () => ({
  load: () => Promise.reject(new Error("corrupt settings.json")),
}));

describe("mergeSettings", () => {
  it("keeps a known game mode and resets an unknown one", () => {
    expect(mergeSettings({ gameMode: "pve" }).gameMode).toBe("pve");
    expect(mergeSettings({ gameMode: "arena" }).gameMode).toBe("regular");
    expect(mergeSettings({ gameMode: 3 }).gameMode).toBe("regular");
  });

  it("replaces the pre-deploy placeholder relay URL and an empty one with the default", () => {
    expect(mergeSettings({ relayUrl: "wss://tartrak-relay.example.workers.dev" }).relayUrl).toBe(DEFAULT_RELAY_URL);
    expect(mergeSettings({ relayUrl: "  " }).relayUrl).toBe(DEFAULT_RELAY_URL);
    expect(mergeSettings({ relayUrl: "wss://my.relay" }).relayUrl).toBe("wss://my.relay");
  });

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

  it("keeps an empty hotkey, which stands for unbound", () => {
    const s = mergeSettings({ hotkeyOverlay: "", hotkeyOpacity: "" });
    expect(s.hotkeyOverlay).toBe("");
    expect(s.hotkeyOpacity).toBe("");
  });

  it("clamps the heading line length to [8, 120]", () => {
    expect(mergeSettings({ lineLengthM: 0 }).lineLengthM).toBe(5);
    expect(mergeSettings({ lineLengthM: 5000 }).lineLengthM).toBe(125);
    expect(mergeSettings({ lineLengthM: 40 }).lineLengthM).toBe(40);
  });

  it("clamps the player level to [0, 79]", () => {
    expect(mergeSettings({ playerLevel: -5 }).playerLevel).toBe(0);
    expect(mergeSettings({ playerLevel: 300 }).playerLevel).toBe(79);
    expect(mergeSettings({ playerLevel: 42 }).playerLevel).toBe(42);
    expect(mergeSettings({ faction: "bear" }).faction).toBe("bear");
    expect(mergeSettings({ faction: "BEAR" }).faction).toBe("any");
    expect(mergeSettings({ faction: 3 }).faction).toBe("any");
  });

  it("defaults layerFilters and todoQuests to empty objects and sharing to off", () => {
    expect(mergeSettings(undefined).layerFilters).toEqual({});
    expect(mergeSettings(undefined).todoQuests).toEqual({});
    expect(mergeSettings(undefined).shareTodo).toBe(false);
    expect(mergeSettings({ shareTodo: true }).shareTodo).toBe(true);
  });

  it("keeps teammate colours that are hex colours keyed by a name, and resets anything else", () => {
    expect(mergeSettings({ mateColors: { Bob: "#a1b2c3", Al: "#fff" } }).mateColors).toEqual({ Bob: "#a1b2c3", Al: "#fff" });
    expect(mergeSettings({ mateColors: { Bob: "red" } }).mateColors).toEqual({});
    expect(mergeSettings({ mateColors: { "": "#fff" } }).mateColors).toEqual({});
    expect(mergeSettings({ mateColors: "x" }).mateColors).toEqual({});
    expect(mergeSettings(undefined).mateColors).toEqual({});
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

  it("keeps todoQuests of true with id-sized keys, resets anything else, and truncates to 200", () => {
    expect(mergeSettings({ todoQuests: { t1: true } }).todoQuests).toEqual({ t1: true });
    expect(mergeSettings({ todoQuests: { t1: false } }).todoQuests).toEqual({});
    expect(mergeSettings({ todoQuests: { ["x".repeat(33)]: true } }).todoQuests).toEqual({});
    expect(mergeSettings({ todoQuests: [] }).todoQuests).toEqual({});
    const many: Record<string, true> = {};
    for (let i = 0; i < 201; i++) many[`t${i}`] = true;
    const kept = mergeSettings({ todoQuests: many }).todoQuests;
    expect(Object.keys(kept)).toHaveLength(200);
    expect(kept["t0"]).toBe(true);
    expect(kept["t200"]).toBeUndefined();
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

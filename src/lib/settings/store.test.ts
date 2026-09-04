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

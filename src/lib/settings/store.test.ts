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
});

describe("loadSettings", () => {
  it("falls back to defaults when the store cannot be opened", async () => {
    await expect(loadSettings()).resolves.toEqual(DEFAULT_SETTINGS);
  });
});

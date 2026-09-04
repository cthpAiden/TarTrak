import { describe, it, expect, vi, beforeEach } from "vitest";
import { register, unregister, isRegistered } from "@tauri-apps/plugin-global-shortcut";
import { nextOpacity, normalizeHotkey, registerHotkeys } from "./window";

vi.mock("@tauri-apps/plugin-global-shortcut", () => ({
  register: vi.fn(),
  unregister: vi.fn(),
  isRegistered: vi.fn(),
}));

const handlers = { toggleOverlay() {}, cycleOpacity() {} };

describe("nextOpacity", () => {
  it("cycles 100 -> 70 -> 40 -> 100 and resets unknown values", () => {
    expect(nextOpacity(100)).toBe(70);
    expect(nextOpacity(70)).toBe(40);
    expect(nextOpacity(40)).toBe(100);
    expect(nextOpacity(55)).toBe(100);
  });
});

describe("normalizeHotkey", () => {
  it("uppercases keys and keeps modifiers", () => {
    expect(normalizeHotkey(" f5 ")).toBe("F5");
    expect(normalizeHotkey("ctrl+shift+f6")).toBe("Ctrl+Shift+F6");
    expect(normalizeHotkey("Alt+m")).toBe("Alt+M");
  });
  it("rejects empty and modifier-only strings", () => {
    expect(normalizeHotkey("")).toBeNull();
    expect(normalizeHotkey("Ctrl+")).toBeNull();
    expect(normalizeHotkey("+")).toBeNull();
  });
});

describe("registerHotkeys", () => {
  /** Stand-in for the OS: a key is "registered" exactly while the plugin says it took. */
  const live = new Set<string>();

  beforeEach(() => {
    live.clear();
    vi.mocked(isRegistered).mockReset().mockImplementation(async (k) => live.has(k));
    vi.mocked(register).mockReset().mockImplementation(async (k) => void live.add(k as string));
    vi.mocked(unregister).mockReset().mockImplementation(async (k) => void live.delete(k as string));
  });

  it("rejects two hotkeys that normalize to the same key", async () => {
    await expect(registerHotkeys("F5", "f5", handlers)).rejects.toThrow(/must differ/);
    expect(register).not.toHaveBeenCalled();
  });

  it("leaves nothing registered when a later key fails", async () => {
    vi.mocked(register).mockImplementation(async (k) => {
      if (k === "F6") throw new Error("taken");
      live.add(k as string);
    });
    await expect(registerHotkeys("F5", "F6", handlers)).rejects.toThrow("taken");
    expect([...live]).toEqual([]);
  });

  it("unhooks every registered key, and does nothing on a second call", async () => {
    const unhook = await registerHotkeys("F5", "F6", handlers);
    expect([...live]).toEqual(["F5", "F6"]);
    await unhook();
    expect([...live]).toEqual([]);
    vi.mocked(unregister).mockClear();
    await unhook();
    expect(unregister).not.toHaveBeenCalled();
  });
});

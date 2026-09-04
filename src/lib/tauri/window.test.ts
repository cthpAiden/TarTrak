import { describe, it, expect } from "vitest";
import { nextOpacity, normalizeHotkey } from "./window";

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

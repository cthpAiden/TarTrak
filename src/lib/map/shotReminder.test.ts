import { describe, it, expect } from "vitest";
import { shotAgeS, shotAgeText } from "./shotReminder";

describe("shotAgeS", () => {
  const END = 10_000_000;

  it("stays off outside a raid and once the raid's end has passed", () => {
    expect(shotAgeS(1_000_000, null, 0, 0, 30)).toBeNull();
    expect(shotAgeS(END, END, 0, 0, 30)).toBeNull();
  });

  it("shows from the delay on, in whole seconds", () => {
    const seen = 1_000_000;
    expect(shotAgeS(seen + 29_999, END, 0, seen, 30)).toBeNull();
    expect(shotAgeS(seen + 30_000, END, 0, seen, 30)).toBe(30);
    expect(shotAgeS(seen + 66_900, END, 0, seen, 30)).toBe(66);
  });

  it("counts from the raid's start until the first screenshot, then from the last screenshot", () => {
    const seen = 1_000_000;
    // A screenshot hides it straight away.
    expect(shotAgeS(seen + 65_000, END, seen + 65_000, seen, 30)).toBeNull();
    expect(shotAgeS(seen + 95_000, END, seen + 65_000, seen, 30)).toBe(30);
    // A screenshot from the last raid does not count against this one.
    expect(shotAgeS(seen + 30_000, END, seen - 500_000, seen, 30)).toBe(30);
  });
});

describe("shotAgeText", () => {
  it.each([
    [30, "30s"],
    [59, "59s"],
    [60, "1:00"],
    [66, "1:06"],
    [725, "12:05"],
  ])("%i -> %s", (s, text) => {
    expect(shotAgeText(s)).toBe(text);
  });
});

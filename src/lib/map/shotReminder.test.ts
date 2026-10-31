import { describe, it, expect } from "vitest";
import { mapGrey, shotFade } from "./shotReminder";

describe("shotFade", () => {
  it.each([
    [0, 45, 0],
    [-5_000, 45, 0],
    [45_000, 45, 0],
    [55_000, 45, 0.5],
    [65_000, 45, 1],
    [600_000, 45, 1],
    [59_999, 60, 0],
    [70_000, 60, 0.5],
    [80_000, 60, 1],
  ])("%i ms since the last screenshot, %is delay -> %f", (since, delay, expected) => {
    expect(shotFade(since, delay)).toBeCloseTo(expected, 6);
  });
});

describe("mapGrey", () => {
  const END = 10_000_000;

  it("stays in colour outside a raid and once the raid's end has passed", () => {
    expect(mapGrey(1_000_000, null, 0, 0, 45)).toBe(0);
    expect(mapGrey(END, END, 0, 0, 45)).toBe(0);
  });

  it("counts from the raid's start until the first screenshot, then from the last screenshot", () => {
    const seen = 1_000_000;
    expect(mapGrey(seen + 55_000, END, 0, seen, 45)).toBeCloseTo(0.5, 6);
    expect(mapGrey(seen + 65_000, END, 0, seen, 45)).toBe(1);
    // A screenshot brings the colour straight back.
    expect(mapGrey(seen + 65_000, END, seen + 65_000, seen, 45)).toBe(0);
    // A screenshot from the last raid does not count against this one.
    expect(mapGrey(seen + 55_000, END, seen - 500_000, seen, 45)).toBeCloseTo(0.5, 6);
  });
});

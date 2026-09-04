import { describe, it, expect } from "vitest";
import { opacityFor } from "./fade";

describe("opacityFor", () => {
  it.each([
    [0, 1],
    [-5, 1],
    [29_999, 1],
    [30_000, 1],
    [165_000, 0.675],
    [300_000, 0.35],
    [300_001, 0.35],
    [1e12, 0.35],
  ])("age %i ms -> %f", (age, expected) => {
    expect(opacityFor(age)).toBeCloseTo(expected, 6);
  });

  it("is monotonically non-increasing", () => {
    let prev = 1;
    for (let t = 0; t <= 400_000; t += 1000) {
      const o = opacityFor(t);
      expect(o).toBeLessThanOrEqual(prev + 1e-12);
      prev = o;
    }
  });
});

import { describe, it, expect } from "vitest";
import { GLYPHS, usesCanvas, pointDivIcon, colorFor } from "./pointLayer";
import type { MapPoint } from "./points";

const pt = (over: Partial<MapPoint> = {}): MapPoint => ({
  id: "p1",
  group: "extracts",
  category: "pmc",
  name: "ZB-1011",
  mapKey: "customs",
  x: 0,
  y: 0,
  z: 0,
  ...over,
});

describe("usesCanvas", () => {
  it("is true only for the dense groups", () => {
    expect(usesCanvas("loot")).toBe(true);
    expect(usesCanvas("spawns")).toBe(true);
    for (const g of ["extracts", "locks", "hazards", "switches", "btr"] as const) {
      expect(usesCanvas(g)).toBe(false);
    }
  });
});

describe("pointDivIcon", () => {
  it("puts the group and category in the class name", () => {
    const icon = pointDivIcon(pt({ group: "locks", category: "door" }));
    expect(icon.options.className).toBe("point-icon locks door");
  });

  it("renders the group glyph", () => {
    expect(pointDivIcon(pt()).options.html).toContain(GLYPHS.extracts);
  });

  it("escapes the name in the title attribute", () => {
    const icon = pointDivIcon(pt({ name: `"><img src=x onerror=alert(1)>` }));
    expect(icon.options.html).not.toContain("<img");
    expect(icon.options.html).toContain("&#34;&#62;&#60;img");
  });
});

describe("colorFor", () => {
  it("resolves by group and category, falling back to the group", () => {
    expect(colorFor(pt({ group: "extracts", category: "transit" }))).toBe("#c58bff");
    expect(colorFor(pt({ group: "loot", category: "sportbag" }))).toBe("#d2b48c");
    expect(colorFor(pt({ group: "spawns", category: "unknown" }))).toBe("#f0d060");
  });
});

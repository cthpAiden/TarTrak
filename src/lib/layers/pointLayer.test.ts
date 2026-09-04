import { describe, it, expect } from "vitest";
import { GLYPHS, usesCanvas, pointDivIcon, pointPopupHtml, colorFor } from "./pointLayer";
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
  details: [],
  ...over,
});

describe("usesCanvas", () => {
  it("is true only for the dense groups", () => {
    expect(usesCanvas("loot")).toBe(true);
    expect(usesCanvas("spawns")).toBe(true);
    expect(usesCanvas("lootLoose")).toBe(true);
    for (const g of ["extracts", "locks", "hazards", "switches", "guns", "btr"] as const) {
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
    expect(GLYPHS.guns).toBe("\u2316");
  });

  it("escapes the name in the title attribute", () => {
    const icon = pointDivIcon(pt({ name: `"><img src=x onerror=alert(1)>` }));
    expect(icon.options.html).not.toContain("<img");
    expect(icon.options.html).toContain("&#34;&#62;&#60;img");
  });
});

describe("pointPopupHtml", () => {
  it("lists the details above the elevation line", () => {
    const html = pointPopupHtml(pt({ name: "ZB-1011", details: ["PMC extract"], y: 12.345 }));
    expect(html).toBe("<b>ZB-1011</b><br><small>PMC extract<br>Elevation 12.3</small>");
  });

  it("still shows the elevation when there are no details", () => {
    expect(pointPopupHtml(pt({ name: "Safe", y: -4 }))).toBe("<b>Safe</b><br><small>Elevation -4.0</small>");
  });

  it("joins every detail line", () => {
    const html = pointPopupHtml(pt({ details: ["Bolts", "Screws", "Nuts"] }));
    expect(html).toContain("Bolts<br>Screws<br>Nuts<br>Elevation 0.0");
  });

  it("escapes the name and the details", () => {
    const html = pointPopupHtml(pt({ name: "<b>x</b>", details: [`<img src=x onerror=alert(1)>`] }));
    expect(html).not.toContain("<img");
    expect(html).toContain("&#60;b&#62;x&#60;/b&#62;");
  });
});

describe("colorFor", () => {
  it("resolves by group and category, falling back to the group", () => {
    expect(colorFor(pt({ group: "extracts", category: "transit" }))).toBe("#c58bff");
    expect(colorFor(pt({ group: "loot", category: "sportbag" }))).toBe("#d2b48c");
    expect(colorFor(pt({ group: "spawns", category: "unknown" }))).toBe("#f0d060");
    expect(colorFor(pt({ group: "lootLoose", category: "item" }))).toBe("#e0d8a0");
  });

  it("gives every boss spawn category its own colour", () => {
    expect(colorFor(pt({ group: "spawns", category: "boss" }))).toBe("#ff5c5c");
    expect(colorFor(pt({ group: "spawns", category: "cultist-priest" }))).toBe("#b06cff");
    expect(colorFor(pt({ group: "spawns", category: "rogue" }))).toBe("#ff9c3c");
    expect(colorFor(pt({ group: "spawns", category: "black-div" }))).toBe("#c8c8c8");
    expect(colorFor(pt({ group: "spawns", category: "af" }))).toBe("#ffd23c");
    expect(colorFor(pt({ group: "spawns", category: "bloodhound" }))).toBe("#ff6cb0");
    expect(colorFor(pt({ group: "guns", category: "gun" }))).toBe("#d0d0d0");
  });
});

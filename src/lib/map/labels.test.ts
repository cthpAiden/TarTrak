import { describe, it, expect } from "vitest";
import { labelPx, labelDivIcon } from "./labels";

describe("labelPx", () => {
  it("scales from the base and clamps small sizes", () => {
    expect(labelPx(undefined)).toBe(13);
    expect(labelPx(80)).toBe(10);
    expect(labelPx(10)).toBe(9);
  });
});

describe("labelDivIcon", () => {
  it("escapes text and applies rotation", () => {
    const icon = labelDivIcon({ position: [0, 0], text: "<b>Big Red</b>", rotation: -90 });
    const html = icon.options.html as string;
    expect(html).toContain("&#60;b&#62;Big Red");
    expect(html).toContain("rotate(-90deg)");
    expect(icon.options.className).toBe("map-label");
  });
});

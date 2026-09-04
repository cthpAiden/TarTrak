import { describe, it, expect } from "vitest";
import { buildSvgElement, showFloor } from "./svgLoader";

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 200">
  <style>.x{fill:red}</style>
  <g id="Ground_Level"><rect width="1" height="1"/></g>
  <g id="Second_Floor"><rect width="1" height="1"/></g>
  <g><rect width="1" height="1"/></g>
</svg>`;

describe("buildSvgElement", () => {
  it("copies the viewBox and lists top-level group ids", () => {
    const s = buildSvgElement(SVG);
    expect(s.element.getAttribute("viewBox")).toBe("0 0 100 200");
    expect(s.groupIds).toEqual(["Ground_Level", "Second_Floor"]);
  });
});

describe("showFloor", () => {
  it("shows only base when no floor is selected", () => {
    const s = buildSvgElement(SVG);
    showFloor(s, "Ground_Level", null);
    const g = (id: string) => s.element.querySelector<SVGGElement>(`#${id}`)!;
    expect(g("Ground_Level").classList.contains("hidden-layer")).toBe(false);
    expect(g("Ground_Level").classList.contains("off-level")).toBe(false);
    expect(g("Second_Floor").classList.contains("hidden-layer")).toBe(true);
  });

  it("shows the floor and dims the base when a floor is selected", () => {
    const s = buildSvgElement(SVG);
    showFloor(s, "Ground_Level", "Second_Floor");
    const g = (id: string) => s.element.querySelector<SVGGElement>(`#${id}`)!;
    expect(g("Second_Floor").classList.contains("hidden-layer")).toBe(false);
    expect(g("Ground_Level").classList.contains("off-level")).toBe(true);
  });
});

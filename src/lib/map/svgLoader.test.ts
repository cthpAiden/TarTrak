import { describe, it, expect } from "vitest";
import { buildSvgElement, showFloor } from "./svgLoader";

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 200">
  <style>.x{fill:red}</style>
  <g id="Ground_Level"><rect width="1" height="1"/></g>
  <g id="Second_Floor"><rect width="1" height="1"/></g>
  <g id="4th_Floor"><rect width="1" height="1"/></g>
  <g><rect width="1" height="1"/></g>
</svg>`;

describe("buildSvgElement", () => {
  it("copies the viewBox and lists top-level group ids", () => {
    const s = buildSvgElement(SVG);
    expect(s.element.getAttribute("viewBox")).toBe("0 0 100 200");
    expect(s.groupIds).toEqual(["Ground_Level", "Second_Floor", "4th_Floor"]);
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

  // "#4th_Floor" is not a valid CSS selector, so the lookup must not go through querySelector.
  it("handles group ids that start with a digit", () => {
    const s = buildSvgElement(SVG);
    showFloor(s, "Ground_Level", "4th_Floor");
    const g = (id: string) => [...s.element.children[0].children].find((c) => c.id === id)!;
    expect(g("4th_Floor").classList.contains("hidden-layer")).toBe(false);
    expect(g("Second_Floor").classList.contains("hidden-layer")).toBe(true);
    expect(g("Ground_Level").classList.contains("off-level")).toBe(true);
  });

  it("shows the floor and dims the base when a floor is selected", () => {
    const s = buildSvgElement(SVG);
    showFloor(s, "Ground_Level", "Second_Floor");
    const g = (id: string) => s.element.querySelector<SVGGElement>(`#${id}`)!;
    expect(g("Second_Floor").classList.contains("hidden-layer")).toBe(false);
    expect(g("Ground_Level").classList.contains("off-level")).toBe(true);
  });
});

describe("buildSvgElement sanitizing", () => {
  it("strips scripts and inline event handlers from fetched markup", () => {
    const s = buildSvgElement(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">
         <script>window.x = 1;</script>
         <g id="Ground_Level"><rect onload="window.y = 1" ONCLICK="window.z = 1" width="1" height="1"/></g>
       </svg>`,
    );
    expect(s.element.querySelector("script")).toBe(null);
    const rect = s.element.querySelector("rect")!;
    expect(rect.hasAttribute("onload")).toBe(false);
    expect(rect.hasAttribute("onclick")).toBe(false);
    expect(rect.getAttribute("width")).toBe("1");
    expect(s.groupIds).toEqual(["Ground_Level"]);
  });
});

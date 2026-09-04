import { describe, it, expect } from "vitest";
import { buildSvgElement, showFloor } from "./svgLoader";

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 200">
  <style>.x{fill:red}</style>
  <g id="Ground_Level"><rect width="1" height="1"/></g>
  <g id="Second_Floor"><rect width="1" height="1"/></g>
  <g id="4th_Floor"><rect width="1" height="1"/></g>
  <g><rect width="1" height="1"/></g>
</svg>`;

const KNOWN = ["Second_Floor", "4th_Floor"];

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
    showFloor(s, "Ground_Level", null, KNOWN);
    const g = (id: string) => s.element.querySelector<SVGGElement>(`#${id}`)!;
    expect(g("Ground_Level").classList.contains("hidden-layer")).toBe(false);
    expect(g("Ground_Level").classList.contains("off-level")).toBe(false);
    expect(g("Second_Floor").classList.contains("hidden-layer")).toBe(true);
  });

  // "#4th_Floor" is not a valid CSS selector, so the lookup must not go through querySelector.
  it("handles group ids that start with a digit", () => {
    const s = buildSvgElement(SVG);
    showFloor(s, "Ground_Level", "4th_Floor", KNOWN);
    const g = (id: string) => [...s.element.children[0].children].find((c) => c.id === id)!;
    expect(g("4th_Floor").classList.contains("hidden-layer")).toBe(false);
    expect(g("Second_Floor").classList.contains("hidden-layer")).toBe(true);
    expect(g("Ground_Level").classList.contains("off-level")).toBe(true);
  });

  it("shows the floor and dims the base when a floor is selected", () => {
    const s = buildSvgElement(SVG);
    showFloor(s, "Ground_Level", "Second_Floor", KNOWN);
    const g = (id: string) => s.element.querySelector<SVGGElement>(`#${id}`)!;
    expect(g("Second_Floor").classList.contains("hidden-layer")).toBe(false);
    expect(g("Ground_Level").classList.contains("off-level")).toBe(true);
  });

  // Customs' First_Floor holds 106 ground-floor interior elements and is in no map definition.
  it("leaves groups the map definition does not know about alone", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 200">
      <g id="Ground_Level"><rect width="1" height="1"/></g>
      <g id="Second_Floor"><rect width="1" height="1"/></g>
      <g id="First_Floor"><rect width="1" height="1"/></g>
    </svg>`;
    const known = ["Second_Floor"];
    const g = (s: ReturnType<typeof buildSvgElement>, id: string) =>
      [...s.element.children[0].children].find((c) => c.id === id)!;

    const a = buildSvgElement(svg);
    showFloor(a, "Ground_Level", null, known);
    expect(g(a, "Second_Floor").classList.contains("hidden-layer")).toBe(true);
    expect(g(a, "First_Floor").classList.contains("hidden-layer")).toBe(false);

    const b = buildSvgElement(svg);
    showFloor(b, "Ground_Level", "Second_Floor", known);
    expect(g(b, "Ground_Level").classList.contains("off-level")).toBe(true);
    expect(g(b, "Second_Floor").classList.contains("hidden-layer")).toBe(false);
    expect(g(b, "First_Floor").classList.contains("hidden-layer")).toBe(false);
    expect(g(b, "First_Floor").classList.contains("off-level")).toBe(false);
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

  it("drops link targets that are not same-document fragments, and keeps the ones that are", () => {
    const s = buildSvgElement(
      `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 10 10">
         <g id="Ground_Level">
           <a id="evil" href="javascript:alert(1)"><rect width="1" height="1"/></a>
           <a id="evil2" xlink:href="  javascript:alert(2)"><rect width="1" height="1"/></a>
           <a id="remote" href="https://example.com/x"><rect width="1" height="1"/></a>
           <use id="ok" href="#Ground_Level"/>
         </g>
       </svg>`,
    );
    const el = (id: string) => s.element.querySelector(`#${id}`)!;
    expect(el("evil").hasAttribute("href")).toBe(false);
    expect(el("evil2").hasAttribute("xlink:href")).toBe(false);
    expect(el("remote").hasAttribute("href")).toBe(false);
    expect(el("ok").getAttribute("href")).toBe("#Ground_Level");
  });

  it("removes foreignObject and animation elements", () => {
    const s = buildSvgElement(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">
         <g id="Ground_Level">
           <foreignObject width="10" height="10"><div>hi</div></foreignObject>
           <a href="#x"><set attributeName="href" to="javascript:alert(1)"/></a>
           <rect width="1" height="1"><animate attributeName="x" to="5"/></rect>
           <rect width="1" height="1"><animateTransform attributeName="transform" to="1"/></rect>
           <rect width="1" height="1"><animateMotion path="M0 0"/></rect>
         </g>
       </svg>`,
    );
    const names = [...s.element.querySelectorAll("*")].map((e) => e.nodeName.toLowerCase());
    for (const name of ["foreignobject", "set", "animate", "animatetransform", "animatemotion"]) {
      expect(names).not.toContain(name);
    }
    expect(s.element.innerHTML).not.toContain("javascript:");
    expect(s.element.querySelectorAll("rect")).toHaveLength(3);
  });
});

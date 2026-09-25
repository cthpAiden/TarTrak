import { describe, it, expect, afterEach } from "vitest";
import { mount, unmount } from "svelte";
import CircleBezel from "./CircleBezel.svelte";
import type { CompassTarget } from "./compass";
import { RING } from "./circle";

const R = 150;
const C = R + RING;

function open(props: { heading: number | null; northUp: boolean; targets?: CompassTarget[]; show?: boolean; offset?: number }) {
  const target = document.body.appendChild(document.createElement("div"));
  const bezel = mount(CircleBezel, { target, props: { r: R, targets: [], ...props } });
  return { target, bezel };
}

function label(target: HTMLElement, text: string): SVGTextElement | undefined {
  return [...target.querySelectorAll<SVGTextElement>("text")].find((t) => t.textContent === text);
}

const kilo: CompassTarget = { id: "mate:k", bearing: 56.5, color: "#00e5ff", label: "Kilo", kind: "mate" };

describe("CircleBezel", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("north-up: N at the top, the heading box at my heading, the number under it left out", () => {
    const { target, bezel } = open({ heading: 65, northUp: true, targets: [kilo] });
    const n = label(target, "N")!;
    expect(Number(n.getAttribute("x"))).toBeCloseTo(C);
    expect(Number(n.getAttribute("y"))).toBeLessThan(C);
    expect(target.querySelector("text.hdg")!.textContent).toBe("065");
    // The box rides the ring to the right of 12 o'clock, over where "60" would be.
    expect(Number(target.querySelector("text.hdg")!.getAttribute("x"))).toBeGreaterThan(C);
    expect(label(target, "60")).toBeUndefined();
    expect(label(target, "120")).toBeDefined();
    expect(target.querySelector("g.mark.mate")!.getAttribute("transform")).toBe(`rotate(56.5 ${C} ${C})`);
    void unmount(bezel);
  });

  it("north-up on a map drawn turned 180°: N at the bottom, the box and teammates turned with it", () => {
    const { target, bezel } = open({ heading: 65, northUp: true, targets: [kilo], offset: 180 });
    const n = label(target, "N")!;
    expect(Number(n.getAttribute("x"))).toBeCloseTo(C);
    expect(Number(n.getAttribute("y"))).toBeGreaterThan(C);
    expect(target.querySelector("text.hdg")!.textContent).toBe("065");
    expect(Number(target.querySelector("text.hdg")!.getAttribute("x"))).toBeLessThan(C);
    expect(Number(target.querySelector("text.hdg")!.getAttribute("y"))).toBeGreaterThan(C);
    expect(target.querySelector("g.mark.mate")!.getAttribute("transform")).toBe(`rotate(236.5 ${C} ${C})`);
    void unmount(bezel);
  });

  it("heading-up: the ring turns so my heading is at the top and N moves round to the left", () => {
    const { target, bezel } = open({ heading: 65, northUp: false, targets: [kilo] });
    const n = label(target, "N")!;
    expect(Number(n.getAttribute("x"))).toBeLessThan(C);
    const box = target.querySelector("text.hdg")!;
    expect(Number(box.getAttribute("x"))).toBeCloseTo(C);
    expect(target.querySelector("g.mark.mate")!.getAttribute("transform")).toBe(`rotate(-8.5 ${C} ${C})`);
    void unmount(bezel);
  });

  it("draws no heading box before the first screenshot", () => {
    const { target, bezel } = open({ heading: null, northUp: false });
    expect(target.querySelector("text.hdg")).toBeNull();
    expect(label(target, "N")).toBeDefined();
    void unmount(bezel);
  });

  it("bezel off leaves only a plain rim", () => {
    const { target, bezel } = open({ heading: 65, northUp: true, targets: [kilo], show: false });
    expect(target.querySelectorAll("text").length).toBe(0);
    expect(target.querySelectorAll("g.mark").length).toBe(0);
    expect(target.querySelectorAll("circle").length).toBe(1);
    void unmount(bezel);
  });
});

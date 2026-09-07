import { describe, it, expect, afterEach, beforeAll, afterAll, vi } from "vitest";
import { mount, unmount } from "svelte";
import CompassTape from "./CompassTape.svelte";
import type { CompassTarget } from "./compass";

// jsdom has no ResizeObserver (bind:clientWidth needs one) and reports clientWidth 0, so the
// component falls back to its default width.
const WIDTH = 324;
class IdleResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function open(heading: number | null, targets: CompassTarget[] = []) {
  const target = document.body.appendChild(document.createElement("div"));
  const tape = mount(CompassTape, { target, props: { heading, targets } });
  return { target, tape };
}

describe("CompassTape", () => {
  beforeAll(() => vi.stubGlobal("ResizeObserver", IdleResizeObserver));
  afterAll(() => vi.unstubAllGlobals());
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("shows --- and nothing else without a heading", () => {
    const { target, tape } = open(null, [{ id: "route", bearing: 10, color: "#f0b429", label: "ZB-013", kind: "route" }]);
    expect(target.querySelector(".pill")!.textContent).toBe("---");
    expect(target.querySelectorAll(".tick").length).toBe(0);
    expect(target.querySelectorAll(".target").length).toBe(0);
    void unmount(tape);
  });

  it("puts the heading in the pill and a target straight ahead under the centre line", () => {
    const { target, tape } = open(214, [{ id: "route", bearing: 214, color: "#f0b429", label: "ZB-013", kind: "route" }]);
    expect(target.querySelector(".pill")!.textContent).toBe("214");
    const marks = target.querySelectorAll<HTMLElement>(".target");
    expect(marks.length).toBe(1);
    expect(marks[0].classList.contains("route")).toBe(true);
    expect(marks[0].classList.contains("clamped")).toBe(false);
    expect(marks[0].style.left).toBe(`${WIDTH / 2}px`);
    expect(marks[0].title).toBe("ZB-013 · 214");
    expect(target.querySelectorAll(".tick").length).toBeGreaterThan(0);
    void unmount(tape);
  });

  it("puts a target 30° clockwise of my heading right of the centre line", () => {
    const { target, tape } = open(214, [{ id: "mate:m1", bearing: 244, color: "#3c3", label: "Aiden", kind: "mate" }]);
    const mate = target.querySelector<HTMLElement>(".target.mate")!;
    expect(mate.classList.contains("clamped")).toBe(false);
    expect(mate.style.left).toBe(`${WIDTH / 2 + 30 * 3}px`);
    void unmount(tape);
  });

  it("drops the tick label the heading pill would sit on, keeps the rest", () => {
    // Heading 95: the 090 label is 15px left of centre, under the pill; 060 and 120 are clear of it.
    const { target, tape } = open(95);
    const labels = Array.from(target.querySelectorAll(".num")).map((n) => n.textContent);
    expect(labels).toEqual(["060", "120"]);
    expect(target.querySelector(".pill")!.textContent).toBe("095");
    void unmount(tape);
  });

  it("pins a teammate behind me to the edge, dimmed", () => {
    const { target, tape } = open(214, [{ id: "m1", bearing: 34, color: "#3c3", label: "Aiden", kind: "mate" }]);
    const mate = target.querySelector<HTMLElement>(".target.mate")!;
    expect(mate.classList.contains("clamped")).toBe(true);
    expect(mate.style.left).toBe("6px");
    void unmount(tape);
  });
});

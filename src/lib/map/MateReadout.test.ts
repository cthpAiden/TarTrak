import { describe, it, expect, afterEach } from "vitest";
import { mount, unmount } from "svelte";
import MateReadout from "./MateReadout.svelte";

type Mate = { id: string; name: string; color: string; distanceM: number | null };

function open(mates: Mate[]) {
  const target = document.body.appendChild(document.createElement("div"));
  const pill = mount(MateReadout, { target, props: { mates } });
  return { target, pill };
}

describe("MateReadout", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("shows one entry per teammate with their distance, name and colour", () => {
    const { target, pill } = open([
      { id: "a", name: "Ann", color: "#ff0000", distanceM: 120 },
      { id: "b", name: "Bob", color: "#00ff00", distanceM: 7 },
    ]);
    const mates = target.querySelectorAll(".mate");
    expect(mates.length).toBe(2);
    expect(mates[0].textContent).toBe("120");
    expect(mates[0].getAttribute("title")).toBe("Ann");
    expect((mates[0] as HTMLElement).style.color).toContain("255, 0, 0");
    expect(mates[1].textContent).toBe("7");
    unmount(pill);
  });

  it("shows ? for a teammate whose distance is unknown", () => {
    const { target, pill } = open([{ id: "a", name: "Ann", color: "#ff0000", distanceM: null }]);
    expect(target.querySelector(".mate")?.textContent).toBe("?");
    unmount(pill);
  });
});

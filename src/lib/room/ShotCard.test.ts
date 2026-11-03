import { describe, it, expect, afterEach, vi } from "vitest";
import { flushSync, mount, unmount } from "svelte";
import ShotCard from "./ShotCard.svelte";
import type { PopupData } from "./popup";

const shot: PopupData = { kind: "shot", from: "Bob", color: "#ff0000", url: "data:image/jpeg;base64,/9j/4AEC" };

function open(data: PopupData = shot) {
  let closed = 0;
  let drags = 0;
  const bigs: boolean[] = [];
  const target = document.body.appendChild(document.createElement("div"));
  const card = mount(ShotCard, {
    target,
    props: { data, onClose: () => closed++, onDrag: () => drags++, onBig: (b: boolean) => bigs.push(b) },
  });
  return { target, card, closed: () => closed, drags: () => drags, bigs };
}

describe("ShotCard", () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("closes itself after 10 s, but not while enlarged", () => {
    vi.useFakeTimers();
    const { target, card, closed } = open();
    flushSync();
    vi.advanceTimersByTime(9_999);
    expect(closed()).toBe(0);
    target.querySelector<HTMLButtonElement>(".pic")!.click();
    flushSync();
    vi.advanceTimersByTime(60_000);
    expect(closed()).toBe(0);
    target.querySelector<HTMLButtonElement>(".pic")!.click();
    flushSync();
    vi.advanceTimersByTime(10_000);
    expect(closed()).toBe(1);
    void unmount(card);
  });

  it("shows who shared the screenshot, in their colour", () => {
    const { target, card } = open();
    expect(target.querySelector(".from")?.textContent).toBe("Bob");
    expect(target.querySelector<HTMLElement>(".from")!.style.color).toBe("rgb(255, 0, 0)");
    expect(target.querySelector<HTMLImageElement>(".pic img")!.src).toBe(shot.kind === "shot" ? shot.url : "");
    void unmount(card);
  });

  it("asks the window to grow on a click on the picture, and to shrink on the next", () => {
    const { target, card, bigs } = open();
    target.querySelector<HTMLButtonElement>(".pic")!.click();
    flushSync();
    target.querySelector<HTMLButtonElement>(".pic")!.click();
    flushSync();
    expect(bigs).toEqual([true, false]);
    void unmount(card);
  });

  it("starts a drag from the header, but not from its close button", () => {
    const { target, card, drags, closed } = open();
    target.querySelector(".head")!.dispatchEvent(new MouseEvent("mousedown", { button: 0, bubbles: true }));
    target.querySelector(".head")!.dispatchEvent(new MouseEvent("mousedown", { button: 2, bubbles: true }));
    target.querySelector(".x")!.dispatchEvent(new MouseEvent("mousedown", { button: 0, bubbles: true }));
    expect(drags()).toBe(1);
    target.querySelector<HTMLButtonElement>(".x")!.click();
    expect(closed()).toBe(1);
    void unmount(card);
  });

  it("shows the placement stand-in until Done, never closing by itself", () => {
    vi.useFakeTimers();
    const { target, card, closed } = open({ kind: "preview" });
    flushSync();
    vi.advanceTimersByTime(60_000);
    expect(closed()).toBe(0);
    expect(target.querySelector("img")).toBeNull();
    target.querySelector<HTMLButtonElement>(".done")!.click();
    expect(closed()).toBe(1);
    void unmount(card);
  });
});

import { describe, it, expect, afterEach, vi } from "vitest";
import { flushSync, mount, unmount } from "svelte";
import ShotCard from "./ShotCard.svelte";

const shot = { from: "Bob", color: "#ff0000", url: "data:image/jpeg;base64,/9j/4AEC", at: 1 };

function open() {
  let closed = 0;
  const target = document.body.appendChild(document.createElement("div"));
  const card = mount(ShotCard, { target, props: { shot, onClose: () => closed++ } });
  return { target, card, closed: () => closed };
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
    target.querySelector<HTMLButtonElement>(".thumb")!.click();
    flushSync();
    vi.advanceTimersByTime(60_000);
    expect(closed()).toBe(0);
    target.querySelector<HTMLButtonElement>(".big")!.click();
    flushSync();
    vi.advanceTimersByTime(10_000);
    expect(closed()).toBe(1);
    void unmount(card);
  });

  it("shows who shared the screenshot, in their colour", () => {
    const { target, card } = open();
    expect(target.querySelector(".from")?.textContent).toBe("Bob");
    expect(target.querySelector<HTMLElement>(".from")!.style.color).toBe("rgb(255, 0, 0)");
    expect(target.querySelector<HTMLImageElement>(".thumb img")!.src).toBe(shot.url);
    void unmount(card);
  });

  it("enlarges on click, and shrinks again on a click or Escape", () => {
    const { target, card } = open();
    target.querySelector<HTMLButtonElement>(".thumb")!.click();
    flushSync();
    target.querySelector<HTMLButtonElement>(".big")!.click();
    flushSync();
    expect(target.querySelector(".big")).toBeNull();
    target.querySelector<HTMLButtonElement>(".thumb")!.click();
    flushSync();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    flushSync();
    expect(target.querySelector(".big")).toBeNull();
    void unmount(card);
  });

  it("closes from its button", () => {
    const { target, card, closed } = open();
    target.querySelector<HTMLButtonElement>(".x")!.click();
    expect(closed()).toBe(1);
    void unmount(card);
  });
});

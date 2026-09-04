import { describe, it, expect, afterEach, vi } from "vitest";
import { flushSync, mount, unmount } from "svelte";
import RoomPanel from "./RoomPanel.svelte";
import { room } from "./controller.svelte";
import { app } from "../state/app.svelte";
import { DEFAULT_SETTINGS } from "../settings/store";

function open() {
  const target = document.body.appendChild(document.createElement("div"));
  const panel = mount(RoomPanel, {
    target,
    props: { settings: { ...DEFAULT_SETTINGS }, onSettingsChange: () => {}, onFocus: () => {} },
  });
  flushSync();
  return { target, panel };
}

function copyButton(target: HTMLElement): HTMLButtonElement | undefined {
  return [...target.querySelectorAll("button")].find((b) => /^Cop(y|ied)$/.test(b.textContent!.trim()));
}

/** Lets the click handler's awaits settle, then paints. */
async function tick() {
  await new Promise((r) => setTimeout(r, 0));
  flushSync();
}

function setClipboard(writeText: () => Promise<void>) {
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
}

describe("RoomPanel code row", () => {
  afterEach(() => {
    room.code = null;
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("shows the code and a Copy button only once joined", () => {
    const a = open();
    expect(a.target.querySelector(".code")).toBe(null);
    expect(copyButton(a.target)).toBe(undefined);
    void unmount(a.panel);

    room.code = "ABC123";
    const b = open();
    expect(b.target.querySelector(".code")!.textContent).toBe("ABC123");
    expect(copyButton(b.target)).toBeDefined();
    void unmount(b.panel);
  });

  it("says Copied once the clipboard write resolves", async () => {
    room.code = "ABC123";
    setClipboard(() => Promise.resolve());
    const { target, panel } = open();
    copyButton(target)!.click();
    await tick();
    expect(copyButton(target)!.textContent!.trim()).toBe("Copied");
    void unmount(panel);
  });

  it("toasts when the clipboard write fails", async () => {
    room.code = "ABC123";
    setClipboard(() => Promise.reject(new Error("denied")));
    const toast = vi.spyOn(app, "toast").mockImplementation(() => {});
    const { target, panel } = open();
    copyButton(target)!.click();
    await tick();
    expect(toast).toHaveBeenCalledWith("Copy failed: select the code and press Ctrl+C");
    expect(copyButton(target)!.textContent!.trim()).toBe("Copy");
    void unmount(panel);
  });
});

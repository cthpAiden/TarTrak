import { describe, it, expect, afterEach } from "vitest";
import { flushSync, mount, unmount } from "svelte";
import SettingsPanel from "./SettingsPanel.svelte";
import { DEFAULT_SETTINGS, type Settings } from "./store";

function open(settings: Partial<Settings> = {}) {
  const changes: Partial<Settings>[] = [];
  const invalid: string[] = [];
  const target = document.body.appendChild(document.createElement("div"));
  const panel = mount(SettingsPanel, {
    target,
    props: {
      settings: { ...DEFAULT_SETTINGS, ...settings },
      onChange: (p) => changes.push(p),
      onPickDir: () => {},
      onInvalid: (m) => invalid.push(m),
    },
  });
  return { target, panel, changes, invalid };
}

function blurWith(target: HTMLElement, id: string, value: string) {
  const input = target.querySelector<HTMLInputElement>(`#${id}`)!;
  input.value = value;
  input.dispatchEvent(new Event("input"));
  flushSync();
  input.dispatchEvent(new FocusEvent("blur"));
  flushSync();
}

describe("SettingsPanel hotkeys", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("takes an empty hotkey as unbound", () => {
    const { target, panel, changes, invalid } = open();
    blurWith(target, "set-hk-overlay", "  ");
    expect(invalid).toEqual([]);
    expect(changes).toEqual([{ hotkeyOverlay: "" }]);
    void unmount(panel);
  });

  it("still rejects a hotkey that cannot be parsed", () => {
    const { target, panel, changes, invalid } = open();
    blurWith(target, "set-hk-opacity", "ctrl+");
    expect(changes).toEqual([]);
    expect(invalid).toEqual(["Invalid hotkey: ctrl+"]);
    void unmount(panel);
  });
});

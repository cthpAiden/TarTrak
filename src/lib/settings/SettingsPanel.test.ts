import { describe, it, expect, afterEach } from "vitest";
import { flushSync, mount, unmount } from "svelte";
import SettingsPanel from "./SettingsPanel.svelte";
import { DEFAULT_RELAY_URL, DEFAULT_SETTINGS, type Settings } from "./store";

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

describe("SettingsPanel faction", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("offers the three factions and reports a pick", () => {
    const { target, panel, changes } = open();
    const select = target.querySelector<HTMLSelectElement>("#set-faction")!;
    expect([...select.options].map((o) => o.value)).toEqual(["any", "usec", "bear"]);
    expect(select.value).toBe("any");
    select.value = "bear";
    // Svelte delegates change events from the root, so the test event must bubble.
    select.dispatchEvent(new Event("change", { bubbles: true }));
    flushSync();
    expect(changes).toEqual([{ faction: "bear" }]);
    void unmount(panel);
  });
});

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

describe("SettingsPanel relay URL", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("falls back to the project relay when the field is blanked", () => {
    const { target, panel, changes } = open({ relayUrl: "wss://mine.example" });
    blurWith(target, "set-relay", "   ");
    expect(changes).toEqual([{ relayUrl: DEFAULT_RELAY_URL }]);
    expect(target.querySelector<HTMLInputElement>("#set-relay")!.value).toBe(DEFAULT_RELAY_URL);
    unmount(panel);
  });

  it("does not report an unchanged URL", () => {
    const { target, panel, changes } = open({ relayUrl: "wss://mine.example" });
    blurWith(target, "set-relay", " wss://mine.example ");
    expect(changes).toEqual([]);
    unmount(panel);
  });
});

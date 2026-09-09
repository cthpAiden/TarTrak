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

describe("SettingsPanel mark-here key", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  function key(code: string) {
    window.dispatchEvent(new KeyboardEvent("keydown", { code, bubbles: true, cancelable: true }));
    flushSync();
  }

  /** A real click: mousedown reaches the window handler first, then the button's click. */
  function clickCapture(btn: HTMLButtonElement) {
    btn.dispatchEvent(new MouseEvent("mousedown", { button: 0, bubbles: true, cancelable: true }));
    btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    flushSync();
  }

  it("shows the stored key and captures the next key pressed", () => {
    const { target, panel, changes } = open();
    const btn = target.querySelector<HTMLButtonElement>("#set-mark-key")!;
    expect(btn.textContent?.trim()).toBe("Left Alt");
    clickCapture(btn);
    expect(btn.textContent?.trim()).toBe("Press a key…");
    key("F7");
    expect(changes).toEqual([{ markKeyVk: 0x76 }]);
    // The prop did not change in this harness, so the button falls back to the stored key.
    expect(btn.textContent?.trim()).toBe("Left Alt");
    void unmount(panel);
  });

  it("ignores keys while not capturing", () => {
    const { panel, changes } = open();
    key("F7");
    expect(changes).toEqual([]);
    void unmount(panel);
  });

  it("Escape cancels, Backspace turns the key off", () => {
    const { target, panel, changes } = open();
    const btn = target.querySelector<HTMLButtonElement>("#set-mark-key")!;
    clickCapture(btn);
    key("Escape");
    expect(changes).toEqual([]);
    expect(btn.textContent?.trim()).toBe("Left Alt");
    clickCapture(btn);
    key("Backspace");
    expect(changes).toEqual([{ markKeyVk: 0 }]);
    void unmount(panel);
  });

  it("refuses PrintScreen as the mark key and keeps capturing", () => {
    const { target, panel, changes, invalid } = open();
    const btn = target.querySelector<HTMLButtonElement>("#set-mark-key")!;
    clickCapture(btn);
    key("PrintScreen");
    expect(changes).toEqual([]);
    expect(invalid).toEqual(["PrintScreen is a screenshot key; pick another key to hold"]);
    expect(btn.textContent?.trim()).toBe("Press a key…");
    void unmount(panel);
  });

  it("shows the screenshot key the game log reported, read-only", () => {
    const { target, panel } = open();
    expect(target.querySelector("[data-testid=shot-key]")?.textContent?.trim()).toBe("PrintScreen");
    expect(target.querySelector("#set-shot-key")).toBeNull();
    void unmount(panel);
  });

  it("takes a side mouse button", () => {
    const { target, panel, changes } = open();
    const btn = target.querySelector<HTMLButtonElement>("#set-mark-key")!;
    clickCapture(btn);
    const down = new MouseEvent("mousedown", { button: 3, bubbles: true, cancelable: true });
    window.dispatchEvent(down);
    flushSync();
    expect(changes).toEqual([{ markKeyVk: 0x05 }]);
    expect(down.defaultPrevented).toBe(true);
    // The webview's back navigation fires on the release, after the capture has already ended.
    const up = new MouseEvent("mouseup", { button: 3, bubbles: true, cancelable: true });
    const aux = new MouseEvent("auxclick", { button: 3, bubbles: true, cancelable: true });
    window.dispatchEvent(up);
    window.dispatchEvent(aux);
    expect(up.defaultPrevented).toBe(true);
    expect(aux.defaultPrevented).toBe(true);
    void unmount(panel);
  });

  it("a second click on the button cancels, a click elsewhere ends the capture", () => {
    const { target, panel, changes } = open();
    const btn = target.querySelector<HTMLButtonElement>("#set-mark-key")!;
    clickCapture(btn);
    expect(btn.textContent?.trim()).toBe("Press a key…");
    clickCapture(btn);
    expect(btn.textContent?.trim()).toBe("Left Alt");
    clickCapture(btn);
    window.dispatchEvent(new MouseEvent("mousedown", { button: 0, bubbles: true, cancelable: true }));
    flushSync();
    expect(btn.textContent?.trim()).toBe("Left Alt");
    expect(changes).toEqual([]);
    void unmount(panel);
  });
});

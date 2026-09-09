import { getCurrentWindow } from "@tauri-apps/api/window";
import { register, unregister, isRegistered } from "@tauri-apps/plugin-global-shortcut";

export const OPACITY_STEPS = [100, 70, 40] as const;

export function nextOpacity(current: number): number {
  const i = OPACITY_STEPS.indexOf(current as (typeof OPACITY_STEPS)[number]);
  if (i < 0) return OPACITY_STEPS[0];
  return OPACITY_STEPS[(i + 1) % OPACITY_STEPS.length];
}

const MODIFIERS: Record<string, string> = {
  ctrl: "Ctrl",
  control: "Ctrl",
  shift: "Shift",
  alt: "Alt",
  super: "Super",
  meta: "Super",
  cmd: "Super",
  command: "Super",
};

function normalizeKey(key: string): string {
  if (/^f\d+$/i.test(key)) return `F${key.slice(1)}`;
  if (key.length === 1) return key.toUpperCase();
  return key[0].toUpperCase() + key.slice(1).toLowerCase();
}

/** "ctrl+shift+f6" -> "Ctrl+Shift+F6". Null when there is no key, or more than one. */
export function normalizeHotkey(s: string): string | null {
  const parts = s
    .split("+")
    .map((p) => p.trim())
    .filter(Boolean);
  const mods: string[] = [];
  let key: string | null = null;
  for (const part of parts) {
    const mod = MODIFIERS[part.toLowerCase()];
    if (mod) mods.push(mod);
    else if (key !== null) return null;
    else key = normalizeKey(part);
  }
  if (key === null) return null;
  return [...mods, key].join("+");
}

export async function setOverlay(on: boolean): Promise<void> {
  const w = getCurrentWindow();
  try {
    await w.setDecorations(!on);
    await w.setAlwaysOnTop(on);
    await w.setSkipTaskbar(on);
  } catch (e) {
    // Half-applied is worse than not applied: undo best effort, then let the caller report it.
    await Promise.allSettled([w.setDecorations(on), w.setAlwaysOnTop(!on), w.setSkipTaskbar(!on)]);
    throw e;
  }
  document.body.classList.toggle("overlay", on);
}

export function applyOpacity(percent: number): void {
  document.documentElement.style.opacity = String(percent / 100);
}

/** Hides the window from the screen. Only the hide hotkey brings it back, so it stays registered. */
export async function setHidden(on: boolean): Promise<void> {
  const w = getCurrentWindow();
  if (on) await w.hide();
  else await w.show();
}

/** Alt + left mouse anywhere drags the window, which is the only way to move it with no title bar. */
export function installAltDrag(): () => void {
  const onDown = (e: MouseEvent) => {
    if (!e.altKey || e.button !== 0) return;
    // Capture phase, and the event stops here: Leaflet's Draggable would otherwise start a drag
    // it never finishes, because the OS drag loop swallows the matching mouseup and leaves the
    // map unpannable for the rest of the session.
    e.preventDefault();
    e.stopPropagation();
    void getCurrentWindow().startDragging();
  };
  window.addEventListener("mousedown", onDown, true);
  return () => window.removeEventListener("mousedown", onDown, true);
}

export async function registerHotkeys(
  overlayKey: string,
  opacityKey: string,
  hideKey: string,
  handlers: { toggleOverlay(): void; cycleOpacity(): void; toggleHidden(): void },
): Promise<() => Promise<void>> {
  const bound: [string | null, () => void][] = [
    [normalizeHotkey(overlayKey), handlers.toggleOverlay],
    [normalizeHotkey(opacityKey), handlers.cycleOpacity],
    [normalizeHotkey(hideKey), handlers.toggleHidden],
  ];
  const keys: [string, () => void][] = [];
  for (const [k, fn] of bound) {
    if (!k) continue;
    // Two actions on one key would leave whichever registered second in sole charge of it.
    if (keys.some(([taken]) => taken === k)) throw new Error("Hotkeys must differ");
    keys.push([k, fn]);
  }

  // Only keys that actually took are unhooked, so a failure part-way through cannot leak one.
  const registered: string[] = [];
  const unhook = async () => {
    for (const k of registered.splice(0)) {
      try {
        if (await isRegistered(k)) await unregister(k);
      } catch {
        // Best effort: a key the OS already dropped must not block the rest.
      }
    }
  };

  try {
    for (const [k, fn] of keys) {
      if (await isRegistered(k)) await unregister(k);
      await register(k, (e) => {
        if (e.state === "Pressed") fn();
      });
      registered.push(k);
    }
  } catch (e) {
    await unhook();
    throw e;
  }
  return unhook;
}

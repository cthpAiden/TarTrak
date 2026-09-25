import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalSize, PhysicalPosition, PhysicalSize } from "@tauri-apps/api/dpi";
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

export async function setOverlay(on: boolean, shape: "circle" | "box" = "box"): Promise<void> {
  const w = getCurrentWindow();
  try {
    await w.setDecorations(!on);
    // Windows draws a 1px white border and a shadow round an undecorated window that keeps its shadow.
    await w.setShadow(!on);
    await w.setAlwaysOnTop(on);
    await w.setSkipTaskbar(on);
  } catch (e) {
    // Half-applied is worse than not applied: undo best effort, then let the caller report it.
    await Promise.allSettled([w.setDecorations(on), w.setShadow(on), w.setAlwaysOnTop(!on), w.setSkipTaskbar(!on)]);
    throw e;
  }
  document.body.classList.toggle("overlay", on);
  document.body.classList.toggle("circle", on && shape === "circle");
}

/** Where the window was and how big, in physical pixels, to put it back after the round minimap. */
export interface WindowRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Must match `minWidth`/`minHeight` in tauri.conf.json: the round minimap lifts the limit while it is up. */
const MIN_WINDOW = { width: 420, height: 300 };

export async function readWindowRect(): Promise<WindowRect> {
  const w = getCurrentWindow();
  const [pos, size] = await Promise.all([w.outerPosition(), w.innerSize()]);
  return { x: pos.x, y: pos.y, width: size.width, height: size.height };
}

/**
 * Shrinks the window around the round minimap. Its top-right corner stays put, so a window parked in the
 * screen's top-right corner stays there; the rest of the old window would otherwise sit over the game.
 */
export async function fitWindowTo(width: number, height: number): Promise<void> {
  const w = getCurrentWindow();
  const [pos, outer, scale] = await Promise.all([w.outerPosition(), w.outerSize(), w.scaleFactor()]);
  const right = pos.x + outer.width;
  await w.setMinSize(null);
  await w.setSize(new LogicalSize(width, height));
  await w.setPosition(new PhysicalPosition(Math.round(right - width * scale), pos.y));
}

/** Puts the window back where and how big it was before the round minimap. */
export async function restoreWindowRect(r: WindowRect): Promise<void> {
  const w = getCurrentWindow();
  await w.setMinSize(new LogicalSize(MIN_WINDOW.width, MIN_WINDOW.height));
  await w.setSize(new PhysicalSize(r.width, r.height));
  await w.setPosition(new PhysicalPosition(r.x, r.y));
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

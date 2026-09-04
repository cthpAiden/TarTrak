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
  await w.setDecorations(!on);
  await w.setAlwaysOnTop(on);
  await w.setSkipTaskbar(on);
  document.body.classList.toggle("overlay", on);
}

export function applyOpacity(percent: number): void {
  document.documentElement.style.opacity = String(percent / 100);
}

/** Alt + left mouse anywhere drags the window, which is the only way to move it with no title bar. */
export function installAltDrag(): () => void {
  const onDown = (e: MouseEvent) => {
    if (!e.altKey || e.button !== 0) return;
    e.preventDefault();
    void getCurrentWindow().startDragging();
  };
  window.addEventListener("mousedown", onDown);
  return () => window.removeEventListener("mousedown", onDown);
}

export async function registerHotkeys(
  overlayKey: string,
  opacityKey: string,
  handlers: { toggleOverlay(): void; cycleOpacity(): void },
): Promise<() => Promise<void>> {
  const keys: [string, () => void][] = [];
  const ov = normalizeHotkey(overlayKey);
  const op = normalizeHotkey(opacityKey);
  if (ov) keys.push([ov, handlers.toggleOverlay]);
  if (op && op !== ov) keys.push([op, handlers.cycleOpacity]);
  for (const [k, fn] of keys) {
    if (await isRegistered(k)) await unregister(k);
    await register(k, (e) => {
      if (e.state === "Pressed") fn();
    });
  }
  return async () => {
    for (const [k] of keys) {
      if (await isRegistered(k)) await unregister(k);
    }
  };
}

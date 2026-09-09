import { listen } from "@tauri-apps/api/event";
import { parseScreenshotName, type Position } from "../parse/screenshot";
import { parseLogLine } from "../parse/log";
import { resolveMapKey } from "../parse/mapNames";
import { shotKeyFromBinding } from "../settings/markKey";
import { app, type AppState } from "../state/app.svelte";

export function handleScreenshot(name: string, state: AppState = app, onPosition?: (p: Position) => void): void {
  const pos = parseScreenshotName(name);
  if (!pos) return; // menu screenshots and unrelated PNGs are silently ignored
  state.setOwnPosition(pos);
  onPosition?.(pos);
}

/** The tail replays the whole log at startup, so an unknown map is reported once, not per line. */
const warnedMaps = new Set<string>();

export function handleLogLine(line: string, state: AppState = app): void {
  const ev = parseLogLine(line);
  if (!ev) return;
  if (ev.kind === "screenshotKey") {
    const vk = shotKeyFromBinding(ev.keys);
    if (vk !== null) state.shotKeyVk = vk;
    else if (!warnedMaps.has("shot:" + ev.keys.join("+"))) {
      warnedMaps.add("shot:" + ev.keys.join("+"));
      state.toast(`Screenshot key in the game log not understood: ${ev.keys.join("+") || "none"}. Mark here assumes PrintScreen.`);
    }
    return;
  }
  if (ev.kind === "gameStarted") {
    // A new raid, possibly on the same map as the last one: the old marker would sit at last raid's spot.
    state.clearOwnPosition();
    state.raidStartedAt = ev.at;
    return;
  }
  const key = resolveMapKey(ev.name);
  if (key) {
    // A raid on a new map makes the last screenshot's position meaningless there, and its clock too.
    if (state.currentMap !== null && state.currentMap !== key) {
      state.clearOwnPosition();
      state.raidStartedAt = null;
    }
    state.setMap(key, "log");
  } else if (ev.kind === "location" && !warnedMaps.has(ev.name)) {
    warnedMaps.add(ev.name);
    state.toast(`Unknown map in log: ${ev.name}. Pick it manually.`);
  }
}

export interface BridgeHooks {
  /** Every position a screenshot yields, after the map has it. */
  onPosition?: (p: Position) => void;
  /** The mark-here key went down (Rust poller). */
  onMarkKey?: () => void;
}

export async function startEventBridge(hooks: BridgeHooks = {}): Promise<() => void> {
  const unShot = await listen<string>("screenshot", (e) => handleScreenshot(e.payload, app, hooks.onPosition));
  const unLog = await listen<string>("logline", (e) => handleLogLine(e.payload));
  const unMark = await listen<void>("markkey", () => hooks.onMarkKey?.());
  return () => {
    unShot();
    unLog();
    unMark();
  };
}

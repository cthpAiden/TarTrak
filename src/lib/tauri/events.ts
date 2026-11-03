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

/** A raid's start, its end moving, and my leaving it: what the raid recorder follows. */
export interface RaidHooks {
  /** I spawned at `at` (epoch ms) into a raid that ends at `endsAt`. */
  onRaidStart?: (at: number, endsAt: number) => void;
  /** The raid's end moved, or the game logged its clock again. */
  onRaidEndsAt?: (endsAt: number) => void;
  /** I left the raid I was in. */
  onRaidOver?: () => void;
}

export function handleLogLine(line: string, state: AppState = app, hooks: RaidHooks = {}): void {
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
    state.raidSeenAt = Date.now();
    return;
  }
  if (ev.kind === "raidClock") {
    const fresh = state.raidEndsAt === null;
    if (fresh) state.raidSeenAt = Date.now();
    state.raidEndsAt = ev.endsAt;
    if (fresh) hooks.onRaidStart?.(ev.at, ev.endsAt);
    else hooks.onRaidEndsAt?.(ev.endsAt);
    return;
  }
  if (ev.kind === "raidEndMoved") {
    if (state.raidEndsAt !== null) {
      state.raidEndsAt += ev.byMs;
      hooks.onRaidEndsAt?.(state.raidEndsAt);
    }
    return;
  }
  if (ev.kind === "raidOver") {
    const wasIn = state.raidEndsAt !== null;
    state.raidEndsAt = null;
    if (wasIn) hooks.onRaidOver?.();
    return;
  }
  const key = resolveMapKey(ev.name);
  if (key) {
    // A raid on a new map makes the last screenshot's position meaningless there.
    if (state.currentMap !== null && state.currentMap !== key) state.clearOwnPosition();
    state.setMap(key, "log");
  } else if (ev.kind === "location" && !warnedMaps.has(ev.name)) {
    warnedMaps.add(ev.name);
    state.toast(`Unknown map in log: ${ev.name}. Pick it manually.`);
  }
}

export interface BridgeHooks extends RaidHooks {
  /** Every position a screenshot yields, after the map has it. */
  onPosition?: (p: Position) => void;
  /** The mark-here key went down (Rust poller). */
  onMarkKey?: () => void;
  /** A second instance was launched; the OS-level plugin already brought the window back. */
  onSecondInstance?: () => void;
}

export async function startEventBridge(hooks: BridgeHooks = {}): Promise<() => void> {
  const unShot = await listen<string>("screenshot", (e) => handleScreenshot(e.payload, app, hooks.onPosition));
  const unLog = await listen<string>("logline", (e) => handleLogLine(e.payload, app, hooks));
  const unMark = await listen<void>("markkey", () => hooks.onMarkKey?.());
  const unSecondInstance = await listen<void>("second-instance", () => hooks.onSecondInstance?.());
  return () => {
    unShot();
    unLog();
    unMark();
    unSecondInstance();
  };
}

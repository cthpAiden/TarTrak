import { listen } from "@tauri-apps/api/event";
import { parseScreenshotName } from "../parse/screenshot";
import { parseLogLine } from "../parse/log";
import { resolveMapKey } from "../parse/mapNames";
import { app, type AppState } from "../state/app.svelte";

export function handleScreenshot(name: string, state: AppState = app): void {
  const pos = parseScreenshotName(name);
  if (!pos) return; // menu screenshots and unrelated PNGs are silently ignored
  state.setOwnPosition(pos);
}

/** The tail replays the whole log at startup, so an unknown map is reported once, not per line. */
const warnedMaps = new Set<string>();

export function handleLogLine(line: string, state: AppState = app): void {
  const ev = parseLogLine(line);
  if (!ev || ev.kind === "gameStarted") return;
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

export async function startEventBridge(): Promise<() => void> {
  const unShot = await listen<string>("screenshot", (e) => handleScreenshot(e.payload));
  const unLog = await listen<string>("logline", (e) => handleLogLine(e.payload));
  return () => {
    unShot();
    unLog();
  };
}

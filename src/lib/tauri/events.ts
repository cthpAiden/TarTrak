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

export function handleLogLine(line: string, state: AppState = app): void {
  const ev = parseLogLine(line);
  if (!ev || ev.kind === "gameStarted") return;
  const key = resolveMapKey(ev.name);
  if (key) {
    state.setMap(key, "log");
  } else if (ev.kind === "location") {
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

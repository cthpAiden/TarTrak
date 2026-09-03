import { invoke } from "@tauri-apps/api/core";

export interface DetectedDirs {
  screenshots: string | null;
  logs: string | null;
}

export const detectDirs = () => invoke<DetectedDirs>("detect_dirs");
export const startScreenshotWatcher = (dir: string, del: boolean) =>
  invoke<void>("start_screenshot_watcher", { dir, delete: del });
export const stopScreenshotWatcher = () => invoke<void>("stop_screenshot_watcher");
export const startLogTail = (logsRoot: string) => invoke<void>("start_log_tail_cmd", { logsRoot });
export const stopLogTail = () => invoke<void>("stop_log_tail_cmd");

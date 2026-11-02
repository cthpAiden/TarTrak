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
/**
 * Mark fires when `shotVk` goes down while `vk` is held; a share is armed the same way with `shareVk`.
 * A key of 0 is off; both off stops the poller.
 */
export const startMarkKey = (vk: number, shotVk: number, shareVk: number) =>
  invoke<void>("start_mark_key", { vk, shotVk, shareVk });
/** The PNG the last `sharedshot` event announced; rejects when it could not be read. */
export const takeSharedShot = () => invoke<ArrayBuffer>("take_shared_shot");

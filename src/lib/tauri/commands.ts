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
/** Mark fires when `shotVk` goes down while `vk` is held; vk 0 stops the poller. */
export const startMarkKey = (vk: number, shotVk: number) => invoke<void>("start_mark_key", { vk, shotVk });
/** A copy of the latest screenshot's PNG; rejects when there is none or it could not be read. */
export const takeSharedShot = () => invoke<ArrayBuffer>("take_shared_shot");
/** Shows `data` (PopupData JSON) in the screenshot popup at `pos` (logical pixels), or the default spot when null. */
export const openShotWindow = (data: string, pos: { x: number; y: number } | null) =>
  invoke<void>("open_shot_window", { data, x: pos?.x ?? null, y: pos?.y ?? null });
/** What the popup shows: `gen` numbers it, so closing an older one leaves a newer one open. */
export const shotPopupData = () => invoke<{ gen: number; data: string }>("shot_popup_data");
export const closeShotWindow = (gen: number) => invoke<void>("close_shot_window", { gen });

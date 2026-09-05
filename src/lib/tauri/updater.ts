import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { ask } from "@tauri-apps/plugin-dialog";

/**
 * Check GitHub Releases for a newer signed build; install only after the user agrees.
 * Runs on every launch (quiet) and from Settings > Check for updates (`manual`, which reports
 * "up to date" and a failed check too). On Windows the installer runs in passive mode: a progress
 * bar, no wizard, and the app exits and relaunches itself once it is done.
 */
export async function checkForUpdate(onInfo: (msg: string) => void, opts: { manual?: boolean } = {}): Promise<void> {
  let update;
  try {
    update = await check();
  } catch (e) {
    // Not toasted on launch: this fails on every offline start. A manual check asked for an answer.
    if (opts.manual) onInfo(`Update check failed: ${e}`);
    else console.warn(`Update check failed: ${e}`);
    return;
  }
  if (!update) {
    if (opts.manual) onInfo("TarTrak is up to date.");
    return;
  }
  // Everything past the prompt can still fail (missing release asset, bad signature, dropped
  // download). Reported, because a silent failure leaves the user believing the update landed.
  try {
    const yes = await ask(`TarTrak ${update.version} is available (you have ${update.currentVersion}). Install it now?`, {
      title: "TarTrak update",
      kind: "info",
      okLabel: "Update",
      cancelLabel: "Later",
    });
    if (!yes) return;
    onInfo(`Downloading TarTrak ${update.version}…`);
    await update.downloadAndInstall();
    await relaunch();
  } catch (e) {
    onInfo(`Update failed: ${e}`);
  }
}

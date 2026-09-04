import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { ask } from "@tauri-apps/plugin-dialog";

/** Check GitHub Releases for a newer signed build; install only after the user agrees. */
export async function checkForUpdate(onInfo: (msg: string) => void): Promise<void> {
  let update;
  try {
    update = await check();
  } catch (e) {
    // Not toasted: this fails on every launch while offline, and for everyone until the release
    // endpoint is configured. A failed install below is different — the user asked for that one.
    console.warn(`Update check failed: ${e}`);
    return;
  }
  if (!update) return;
  // Everything past the prompt can still fail (missing release asset, bad signature, dropped
  // download). Reported, because a silent failure leaves the user believing the update landed.
  try {
    const yes = await ask(`TarTrak ${update.version} is available. Install now?`, { title: "Update", kind: "info" });
    if (!yes) return;
    await update.downloadAndInstall();
    await relaunch();
  } catch (e) {
    onInfo(`Update failed: ${e}`);
  }
}

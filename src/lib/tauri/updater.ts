import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { ask } from "@tauri-apps/plugin-dialog";

/** Check GitHub Releases for a newer signed build; install only after the user agrees. */
export async function checkForUpdate(onInfo: (msg: string) => void): Promise<void> {
  let update;
  try {
    update = await check();
  } catch (e) {
    onInfo(`Update check failed: ${e}`);
    return;
  }
  if (!update) return;
  const yes = await ask(`TarTrak ${update.version} is available. Install now?`, { title: "Update", kind: "info" });
  if (!yes) return;
  await update.downloadAndInstall();
  await relaunch();
}

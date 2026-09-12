import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { ask } from "@tauri-apps/plugin-dialog";

/** The manifest is a few hundred bytes; a check that takes longer than this is a dead connection. */
const CHECK_TIMEOUT_MS = 30_000;
/** Whole download, a ~5 MB installer: ten minutes covers a slow link, a stalled one fails instead of hanging. */
const DOWNLOAD_TIMEOUT_MS = 10 * 60_000;

export interface UpdateUi {
  /** A one-off message. */
  info(msg: string): void;
  /** The one download-progress line, reworded as it goes; null takes it down. */
  progress(msg: string | null): void;
}

/**
 * Check GitHub Releases for a newer signed build; install only after the user agrees.
 * Runs on every launch (quiet) and from Settings > Check for updates (`manual`, which reports
 * "up to date" and a failed check too). On Windows the installer runs in passive mode: a progress
 * bar, no wizard, and the app exits and relaunches itself once it is done.
 */
export async function checkForUpdate(ui: UpdateUi, opts: { manual?: boolean } = {}): Promise<void> {
  let update;
  try {
    update = await check({ timeout: CHECK_TIMEOUT_MS });
  } catch (e) {
    // Not toasted on launch: this fails on every offline start. A manual check asked for an answer.
    if (opts.manual) ui.info(`Update check failed: ${e}`);
    else console.warn(`Update check failed: ${e}`);
    return;
  }
  if (!update) {
    if (opts.manual) ui.info("TarTrak is up to date.");
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
    const downloading = `Downloading TarTrak ${update.version}…`;
    ui.progress(downloading);
    let total: number | undefined;
    let got = 0;
    let shown = -1;
    await update.downloadAndInstall(
      (ev) => {
        if (ev.event === "Started") total = ev.data.contentLength;
        else if (ev.event === "Progress") {
          got += ev.data.chunkLength;
          if (!total) return;
          const pct = Math.min(100, Math.floor((got * 100) / total));
          if (pct === shown) return;
          shown = pct;
          ui.progress(`${downloading} ${pct}%`);
        } else if (ev.event === "Finished") ui.progress(`Installing TarTrak ${update.version}…`);
      },
      { timeout: DOWNLOAD_TIMEOUT_MS },
    );
    await relaunch();
  } catch (e) {
    ui.progress(null);
    ui.info(`Update failed: ${e}`);
  }
}

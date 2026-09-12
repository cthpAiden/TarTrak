import { describe, it, expect, vi, beforeEach } from "vitest";
import { check, type DownloadEvent } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { ask } from "@tauri-apps/plugin-dialog";
import { checkForUpdate } from "./updater";

vi.mock("@tauri-apps/plugin-updater", () => ({ check: vi.fn() }));
vi.mock("@tauri-apps/plugin-process", () => ({ relaunch: vi.fn() }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ ask: vi.fn() }));

const checkMock = vi.mocked(check);
const askMock = vi.mocked(ask);
const relaunchMock = vi.mocked(relaunch);

/** Minimal stand-in for the plugin's Update object; only the parts checkForUpdate touches. */
function fakeUpdate(downloadAndInstall = vi.fn().mockResolvedValue(undefined)) {
  return { version: "1.2.3", currentVersion: "1.0.0", downloadAndInstall } as never;
}

/** A download that streams the given chunks to the caller's progress callback, then installs. */
function streaming(contentLength: number | undefined, chunks: number[]) {
  return vi.fn().mockImplementation(async (onEvent: (ev: DownloadEvent) => void) => {
    onEvent({ event: "Started", data: { contentLength } });
    for (const chunkLength of chunks) onEvent({ event: "Progress", data: { chunkLength } });
    onEvent({ event: "Finished" });
  });
}

describe("checkForUpdate", () => {
  let messages: string[];
  /** Every progress line as it was shown, "(gone)" when it was taken down. */
  let progress: string[];
  const ui = {
    info: (m: string) => messages.push(m),
    progress: (m: string | null) => progress.push(m ?? "(gone)"),
  };

  beforeEach(() => {
    vi.resetAllMocks();
    messages = [];
    progress = [];
  });

  it("does nothing when no update is available", async () => {
    checkMock.mockResolvedValue(null);
    await checkForUpdate(ui);
    expect(checkMock).toHaveBeenCalledWith({ timeout: 30_000 });
    expect(askMock).not.toHaveBeenCalled();
    expect(relaunchMock).not.toHaveBeenCalled();
    expect(messages).toEqual([]);
    expect(progress).toEqual([]);
  });

  it("reports 'up to date' and a failed check when asked by hand", async () => {
    checkMock.mockResolvedValue(null);
    await checkForUpdate(ui, { manual: true });
    checkMock.mockRejectedValue(new Error("offline"));
    await checkForUpdate(ui, { manual: true });
    expect(askMock).not.toHaveBeenCalled();
    expect(messages).toEqual(["TarTrak is up to date.", "Update check failed: Error: offline"]);
  });

  // A failed check happens on every offline launch, so it is logged rather than toasted.
  it("logs a failed check without prompting or toasting", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    checkMock.mockRejectedValue(new Error("offline"));
    await checkForUpdate(ui);
    expect(askMock).not.toHaveBeenCalled();
    expect(messages).toEqual([]);
    expect(warn).toHaveBeenCalledWith("Update check failed: Error: offline");
    warn.mockRestore();
  });

  it("does not install when the user declines", async () => {
    const install = vi.fn();
    checkMock.mockResolvedValue(fakeUpdate(install));
    askMock.mockResolvedValue(false);
    await checkForUpdate(ui);
    expect(install).not.toHaveBeenCalled();
    expect(relaunchMock).not.toHaveBeenCalled();
    expect(messages).toEqual([]);
    expect(progress).toEqual([]);
  });

  it("installs and relaunches when the user agrees, with a download timeout", async () => {
    const install = vi.fn().mockResolvedValue(undefined);
    checkMock.mockResolvedValue(fakeUpdate(install));
    askMock.mockResolvedValue(true);
    await checkForUpdate(ui);
    expect(askMock).toHaveBeenCalledWith("TarTrak 1.2.3 is available (you have 1.0.0). Install it now?", {
      title: "TarTrak update",
      kind: "info",
      okLabel: "Update",
      cancelLabel: "Later",
    });
    expect(install).toHaveBeenCalledOnce();
    expect(install.mock.calls[0][1]).toEqual({ timeout: 600_000 });
    expect(relaunchMock).toHaveBeenCalledOnce();
    expect(messages).toEqual([]);
    expect(progress).toEqual(["Downloading TarTrak 1.2.3…"]);
  });

  // One line per whole percent, so a 16 KiB chunk stream does not reword the toast hundreds of times.
  it("shows the download as a percentage, then the install", async () => {
    checkMock.mockResolvedValue(fakeUpdate(streaming(1000, [200, 200, 5, 595])));
    askMock.mockResolvedValue(true);
    await checkForUpdate(ui);
    expect(progress).toEqual([
      "Downloading TarTrak 1.2.3…",
      "Downloading TarTrak 1.2.3… 20%",
      "Downloading TarTrak 1.2.3… 40%",
      "Downloading TarTrak 1.2.3… 100%",
      "Installing TarTrak 1.2.3…",
    ]);
  });

  it("shows no percentage when the size is unknown", async () => {
    checkMock.mockResolvedValue(fakeUpdate(streaming(undefined, [200, 200])));
    askMock.mockResolvedValue(true);
    await checkForUpdate(ui);
    expect(progress).toEqual(["Downloading TarTrak 1.2.3…", "Installing TarTrak 1.2.3…"]);
  });

  it("reports a failed install, takes the progress line down and does not relaunch", async () => {
    checkMock.mockResolvedValue(fakeUpdate(vi.fn().mockRejectedValue(new Error("404 asset"))));
    askMock.mockResolvedValue(true);
    await checkForUpdate(ui);
    expect(relaunchMock).not.toHaveBeenCalled();
    expect(progress).toEqual(["Downloading TarTrak 1.2.3…", "(gone)"]);
    expect(messages).toEqual(["Update failed: Error: 404 asset"]);
  });
});

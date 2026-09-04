import { describe, it, expect, vi, beforeEach } from "vitest";
import { check } from "@tauri-apps/plugin-updater";
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
  return { version: "1.2.3", downloadAndInstall } as never;
}

describe("checkForUpdate", () => {
  let messages: string[];
  const onInfo = (m: string) => messages.push(m);

  beforeEach(() => {
    vi.resetAllMocks();
    messages = [];
  });

  it("does nothing when no update is available", async () => {
    checkMock.mockResolvedValue(null);
    await checkForUpdate(onInfo);
    expect(askMock).not.toHaveBeenCalled();
    expect(relaunchMock).not.toHaveBeenCalled();
    expect(messages).toEqual([]);
  });

  // A failed check happens on every offline launch, so it is logged rather than toasted.
  it("logs a failed check without prompting or toasting", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    checkMock.mockRejectedValue(new Error("offline"));
    await checkForUpdate(onInfo);
    expect(askMock).not.toHaveBeenCalled();
    expect(messages).toEqual([]);
    expect(warn).toHaveBeenCalledWith("Update check failed: Error: offline");
    warn.mockRestore();
  });

  it("does not install when the user declines", async () => {
    const install = vi.fn();
    checkMock.mockResolvedValue(fakeUpdate(install));
    askMock.mockResolvedValue(false);
    await checkForUpdate(onInfo);
    expect(install).not.toHaveBeenCalled();
    expect(relaunchMock).not.toHaveBeenCalled();
    expect(messages).toEqual([]);
  });

  it("installs and relaunches when the user agrees", async () => {
    const install = vi.fn().mockResolvedValue(undefined);
    checkMock.mockResolvedValue(fakeUpdate(install));
    askMock.mockResolvedValue(true);
    await checkForUpdate(onInfo);
    expect(install).toHaveBeenCalledOnce();
    expect(relaunchMock).toHaveBeenCalledOnce();
    expect(messages).toEqual([]);
  });

  it("reports a failed install and does not relaunch", async () => {
    checkMock.mockResolvedValue(fakeUpdate(vi.fn().mockRejectedValue(new Error("404 asset"))));
    askMock.mockResolvedValue(true);
    await checkForUpdate(onInfo);
    expect(relaunchMock).not.toHaveBeenCalled();
    expect(messages).toEqual(["Update failed: Error: 404 asset"]);
  });
});

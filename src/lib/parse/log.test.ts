import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseLogLine } from "./log";

const excerpt = readFileSync("tests/fixtures/application_000.excerpt.log", "utf8").split(/\r?\n/);

describe("parseLogLine", () => {
  it("detects the scene preset line", () => {
    const line =
      "2026-09-04 04:52:16.615|1.1.0.1.46911|Info|application|scene preset path:maps/lighthouse_preset.bundle rcid:lighthouse.scenespreset.asset";
    expect(parseLogLine(line)).toEqual({ kind: "preset", name: "lighthouse" });
  });

  it("detects the Location field in profileStatus", () => {
    const line =
      "2026-09-04 04:52:58.415|1.1.0.1.46911|Debug|application|TRACE-NetworkGameCreate profileStatus: 'Profileid: X, Status: Busy, RaidMode: Online, Ip: 0.0.0.0, Port: 17000, Location: TarkovStreets, Sid: S, GameMode: deathmatch, shortId: Q'";
    expect(parseLogLine(line)).toEqual({ kind: "location", name: "TarkovStreets" });
  });

  it("detects GameStarted", () => {
    const line =
      "2026-09-04 04:56:12.284|1.1.0.1.46911|Info|application|GameStarted:215.23(215.23) real:236.94(236.94) diff:21.71";
    expect(parseLogLine(line)).toEqual({ kind: "gameStarted" });
  });

  it("reads the raid's end from the game's own clock: the line's time plus session time minus time already past", () => {
    // A Scav raid joined 23 min in; the PC clock runs 45 s behind the server's utcNow, which must not matter.
    const line =
      "2026-10-25 01:52:35.519|1.2.5.0.48146|Info|output|GameTimer utcNow:10/24/2026 18:53:20 start:10/24/2026 18:30:11 escape:10/24/2026 19:10:11 PastTime:00:23:08.9320000 stop:01/01/0001 00:00:00 (startTime:10/24/2026 18:30:11, sessionTime:00:40:00)";
    const left = (16 * 60 + 51.068) * 1000;
    expect(parseLogLine(line)).toEqual({ kind: "raidClock", endsAt: new Date(2026, 9, 25, 1, 52, 35, 519).getTime() + left });
  });

  it("reads a PMC raid that started on time", () => {
    const line =
      "2026-10-26 01:01:19.187|1.2.5.0.48146|Info|output|GameTimer utcNow:10/25/2026 18:02:04 start:10/25/2026 18:02:04 escape:10/25/2026 18:42:04 PastTime:00:00:00.0010000 stop:01/01/0001 00:00:00 (startTime:10/25/2026 18:02:04, sessionTime:00:40:00)";
    expect(parseLogLine(line)).toEqual({ kind: "raidClock", endsAt: new Date(2026, 9, 26, 1, 1, 19, 187).getTime() + 40 * 60_000 - 1 });
  });

  it("treats the hideout's clock, which has no session time, as no raid", () => {
    const line =
      "2026-10-26 00:18:11.487|1.2.5.0.48146|Info|output|GameTimer utcNow:10/25/2026 17:18:56 start:10/25/2026 17:18:56 escape: PastTime:00:00:00 stop:01/01/0001 00:00:00 (startTime:, sessionTime:)";
    expect(parseLogLine(line)).toEqual({ kind: "raidOver" });
  });

  it("drops a GameTimer line whose timestamp cannot be read", () => {
    expect(parseLogLine("garbage|GameTimer utcNow:x start:x escape:x PastTime:00:00:01 stop:x (startTime:x, sessionTime:00:40:00)")).toBeNull();
  });

  it("moves the end when the game moves it mid-raid, and ignores the first setting (GameTimer follows it)", () => {
    expect(
      parseLogLine("2026-09-18 12:51:51.045|1.1.5.0.47426|Info|output|Escape dateTime update to:09/18/2026 06:01:49 from:09/18/2026 06:26:22"),
    ).toEqual({ kind: "raidEndMoved", byMs: -(24 * 60 + 33) * 1000 });
    expect(parseLogLine("2026-10-25 01:52:35.518|1.2.5.0.48146|Info|output|Escape dateTime update to:10/24/2026 19:10:11 from:")).toBeNull();
  });

  it("ends the raid when the game leaves its server", () => {
    const line = "2026-10-26 01:36:40.790|1.2.5.0.48146|Info|output|Connection.Disconnect() TransportId:0 address:178.249.213.71 Reason:Stop game";
    expect(parseLogLine(line)).toEqual({ kind: "raidOver" });
  });

  it("returns null for unrelated lines", () => {
    expect(parseLogLine("2026-09-04 05:04:47.992|1.1.0.1.46911|Info|application|GC::Collect")).toBeNull();
    expect(parseLogLine("")).toBeNull();
  });

  it("reads the screenshot binding out of the control-settings dump", () => {
    const line =
      '{"InvertedXAxis":false,"keyBindings":[{"keyName":"OpticCalibrationSwitchDown","variants":[{"keyCode":["PageDown"],"axisName":""},{"keyCode":[]}],"pressType":"Press"},{"keyName":"MakeScreenshot","variants":[{"keyCode":["V"]},{"keyCode":[]}],"pressType":"Press"},{"keyName":"Recorder","variants":[{"keyCode":[]},{"keyCode":[]}],"pressType":"Release"}]}';
    expect(parseLogLine(line)).toEqual({ kind: "screenshotKey", keys: ["V"] });
    expect(parseLogLine('"keyName":"MakeScreenshot","variants":[{"keyCode":["LeftAlt","F12"]},{"keyCode":[]}]')).toEqual({
      kind: "screenshotKey",
      keys: ["LeftAlt", "F12"],
    });
    expect(parseLogLine('"keyName":"MakeScreenshot","variants":[{"keyCode":[]},{"keyCode":[]}]')).toEqual({ kind: "screenshotKey", keys: [] });
  });

  it("finds preset, location and gameStarted in the real excerpt, in that order", () => {
    const events = excerpt.map(parseLogLine).filter((e) => e !== null);
    const kinds = events.map((e) => e!.kind);
    expect(kinds.indexOf("preset")).toBeGreaterThanOrEqual(0);
    expect(kinds.indexOf("location")).toBeGreaterThan(kinds.indexOf("preset"));
    expect(kinds.indexOf("gameStarted")).toBeGreaterThan(kinds.indexOf("location"));
    expect(events.find((e) => e!.kind === "location")).toEqual({ kind: "location", name: "Lighthouse" });
  });
});

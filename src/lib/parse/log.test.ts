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

  it("returns null for unrelated lines", () => {
    expect(parseLogLine("2026-09-04 05:04:47.992|1.1.0.1.46911|Info|application|GC::Collect")).toBeNull();
    expect(parseLogLine("")).toBeNull();
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

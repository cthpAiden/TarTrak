import { describe, it, expect } from "vitest";
import { AppState } from "../state/app.svelte";
import { handleScreenshot, handleLogLine } from "./events";

describe("handleScreenshot", () => {
  it("sets own position from a valid filename", () => {
    const s = new AppState();
    handleScreenshot("2026-09-04[04-56]_-230.88, 3.59, -375.83_-0.02798, -0.17807, 0.00669, -0.98360_0.64 (0).png", s);
    expect(s.ownPos?.x).toBeCloseTo(-230.88);
    expect(s.ownUpdatedAt).toBeGreaterThan(0);
  });

  it("ignores menu screenshots and keeps the previous position", () => {
    const s = new AppState();
    s.setOwnPosition({ x: 1, y: 2, z: 3, yaw: 4 }, 1000);
    handleScreenshot("2026-09-04[01-12]_7.92 (0).png", s);
    expect(s.ownPos).toEqual({ x: 1, y: 2, z: 3, yaw: 4 });
    expect(s.ownUpdatedAt).toBe(1000);
    expect(s.toasts).toHaveLength(0);
  });
});

describe("handleLogLine", () => {
  const loc = (name: string) =>
    `2026-09-04 04:52:58.415|1.1.0.1.46911|Debug|application|TRACE-NetworkGameCreate profileStatus: 'Profileid: X, Location: ${name}, Sid: S'`;

  it("switches the map on a known Location and marks source as log", () => {
    const s = new AppState();
    handleLogLine(loc("TarkovStreets"), s);
    expect(s.currentMap).toBe("streets-of-tarkov");
    expect(s.mapSource).toBe("log");
  });

  it("overrides a manual choice when the log names a new map", () => {
    const s = new AppState();
    s.setMap("woods", "manual");
    handleLogLine(loc("Lighthouse"), s);
    expect(s.currentMap).toBe("lighthouse");
  });

  it("keeps the current map and toasts once on an unknown Location", () => {
    const s = new AppState();
    s.setMap("woods", "manual");
    handleLogLine(loc("SomeNewMap"), s);
    expect(s.currentMap).toBe("woods");
    expect(s.toasts.map((t) => t.text)).toEqual(["Unknown map in log: SomeNewMap. Pick it manually."]);
  });

  it("uses the scene preset as an early hint", () => {
    const s = new AppState();
    handleLogLine(
      "2026-09-04 04:52:16.615|1.1.0.1.46911|Info|application|scene preset path:maps/city_preset.bundle rcid:x",
      s,
    );
    expect(s.currentMap).toBe("streets-of-tarkov");
  });

  it("ignores unrelated lines", () => {
    const s = new AppState();
    handleLogLine("2026-09-04 05:04:47.992|1.1.0.1.46911|Info|application|GC::Collect", s);
    expect(s.currentMap).toBeNull();
  });
});

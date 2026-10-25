import { describe, it, expect, vi } from "vitest";
import { listen } from "@tauri-apps/api/event";
import { AppState } from "../state/app.svelte";
import { handleScreenshot, handleLogLine, startEventBridge } from "./events";

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(),
}));

describe("handleScreenshot", () => {
  it("sets own position from a valid filename", () => {
    const s = new AppState();
    handleScreenshot("2026-09-04[04-56]_-230.88, 3.59, -375.83_-0.02798, -0.17807, 0.00669, -0.98360_0.64 (0).png", s);
    expect(s.ownPos?.x).toBeCloseTo(-230.88);
    expect(s.ownUpdatedAt).toBeGreaterThan(0);
  });

  it("hands the parsed position to the hook, not for menu screenshots", () => {
    const s = new AppState();
    const seen: number[] = [];
    handleScreenshot("2026-09-04[04-56]_-230.88, 3.59, -375.83_-0.02798, -0.17807, 0.00669, -0.98360_0.64 (0).png", s, (p) => seen.push(p.x));
    handleScreenshot("2026-09-04[01-12]_7.92 (0).png", s, (p) => seen.push(p.x));
    expect(seen).toHaveLength(1);
    expect(seen[0]).toBeCloseTo(-230.88);
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

  it("takes the screenshot key from the settings dump and toasts once on one it cannot read", () => {
    const s = new AppState();
    expect(s.shotKeyVk).toBeNull();
    handleLogLine('x "keyName":"MakeScreenshot","variants":[{"keyCode":["V"]},{"keyCode":[]}] y', s);
    expect(s.shotKeyVk).toBe(0x56);
    handleLogLine('"keyName":"MakeScreenshot","variants":[{"keyCode":["Joystick1Button3"]},{"keyCode":[]}]', s);
    handleLogLine('"keyName":"MakeScreenshot","variants":[{"keyCode":["Joystick1Button3"]},{"keyCode":[]}]', s);
    expect(s.shotKeyVk).toBe(0x56);
    expect(s.toasts.map((t) => t.text)).toEqual([
      "Screenshot key in the game log not understood: Joystick1Button3. Mark here assumes PrintScreen.",
    ]);
  });

  it("drops the old position when the log moves to another map, keeps it on the same map", () => {
    const s = new AppState();
    s.setMap("woods", "log");
    s.setOwnPosition({ x: 1, y: 2, z: 3, yaw: 4 }, 1000);
    handleLogLine(loc("Woods"), s);
    expect(s.ownPos).not.toBeNull();
    handleLogLine(loc("Lighthouse"), s);
    expect(s.ownPos).toBeNull();
    expect(s.ownUpdatedAt).toBe(0);
    expect(s.currentMap).toBe("lighthouse");
  });

  it("warns about a given unknown map only once across the replayed log", () => {
    const s = new AppState();
    handleLogLine(loc("Atlantis"), s);
    handleLogLine(loc("Atlantis"), s);
    expect(s.toasts).toHaveLength(1);
  });

  it("clears the old position when a raid starts, so a repeat of the same map starts clean", () => {
    const s = new AppState();
    s.setMap("factory", "log");
    s.setOwnPosition({ x: 1, y: 2, z: 3, yaw: 4 }, 1000);
    handleLogLine("2026-09-04 04:56:12.284|1.1.0.1.46911|Info|application|GameStarted:215.23(215.23) real:236.94(236.94) diff:21.71", s);
    expect(s.ownPos).toBeNull();
    expect(s.currentMap).toBe("factory");
  });

  it("takes the raid's end from the game's clock, moves it when the game does, and drops it on leaving", () => {
    const s = new AppState();
    handleLogLine(
      "2026-09-18 12:51:34.321|1.1.5.0.47426|Info|output|GameTimer utcNow:09/18/2026 05:51:33 start:09/18/2026 05:51:22 escape:09/18/2026 06:26:22 PastTime:00:00:10.7960000 stop:01/01/0001 00:00:00 (startTime:09/18/2026 05:51:22, sessionTime:00:35:00)",
      s,
    );
    const endsAt = new Date(2026, 8, 18, 12, 51, 34, 321).getTime() + 35 * 60_000 - 10_796;
    expect(s.raidEndsAt).toBe(endsAt);
    handleLogLine("2026-09-18 12:51:51.045|1.1.5.0.47426|Info|output|Escape dateTime update to:09/18/2026 06:01:49 from:09/18/2026 06:26:22", s);
    expect(s.raidEndsAt).toBe(endsAt - (24 * 60 + 33) * 1000);
    handleLogLine("2026-09-18 12:59:18.481|1.1.5.0.47426|Info|output|Connection.Disconnect() TransportId:4294967296 address:178.249.213.71 Reason:Stop game", s);
    expect(s.raidEndsAt).toBeNull();
  });

  it("keeps the raid's end through a map change: the clock no longer depends on the map", () => {
    const s = new AppState();
    s.setMap("factory", "log");
    s.raidEndsAt = 123;
    handleLogLine(loc("Lighthouse"), s);
    expect(s.raidEndsAt).toBe(123);
  });

  it("ignores a moved end when no raid clock is known", () => {
    const s = new AppState();
    handleLogLine("2026-09-18 12:51:51.045|1.1.5.0.47426|Info|output|Escape dateTime update to:09/18/2026 06:01:49 from:09/18/2026 06:26:22", s);
    expect(s.raidEndsAt).toBeNull();
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

describe("startEventBridge", () => {
  it("calls onSecondInstance when the second-instance event fires", async () => {
    const handlers = new Map<string, (e: { payload: unknown }) => void>();
    vi.mocked(listen).mockImplementation(async (event, handler) => {
      handlers.set(event as string, handler as (e: { payload: unknown }) => void);
      return () => {};
    });
    const onSecondInstance = vi.fn();
    await startEventBridge({ onSecondInstance });
    handlers.get("second-instance")!({ payload: undefined });
    expect(onSecondInstance).toHaveBeenCalledOnce();
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RaidLog, MAX_RAIDS } from "./log.svelte";
import { startRaid, type RaidRecord } from "./record";

vi.mock("@tauri-apps/plugin-store", () => ({ load: vi.fn() }));

const pos = { x: 1, y: 2, z: 3, yaw: 90 };
const mate = (receivedAt: number) => ({ name: "Rook", color: "#5aa9e6", map: "customs", x: receivedAt, y: 0, z: 0, yaw: 0, receivedAt });

describe("RaidLog", () => {
  let saved: RaidRecord[][];
  let log: RaidLog;
  beforeEach(() => {
    vi.useFakeTimers();
    saved = [];
    log = new RaidLog(async (r) => void saved.push(r));
  });
  afterEach(() => vi.useRealTimers());

  it("records a raid with my screenshots, saves it when I leave and hands it back", () => {
    log.start(1000, 9000, "customs", 1000);
    log.own(pos, "customs", 1200);
    log.own(pos, "customs", 1300);
    const done = log.over(2000);
    expect(done?.me.length).toBe(2);
    expect(done?.leftAt).toBe(2000);
    expect(log.raids).toHaveLength(1);
    expect(saved.at(-1)).toEqual(log.raids);
  });

  it("keeps nothing from a raid without a screenshot of mine", () => {
    log.start(1000, 9000, "customs", 1000);
    log.mate(mate(1500));
    expect(log.over(2000)).toBeNull();
    expect(log.raids).toEqual([]);
  });

  it("ignores a raid whose end has passed: the log replays old raids at startup", () => {
    log.start(1000, 9000, "customs", 10_000);
    log.own(pos, "customs", 10_100);
    expect(log.raids).toEqual([]);
  });

  it("follows teammates after I leave, until my next raid starts", () => {
    log.start(1000, 90_000, "customs", 1000);
    log.own(pos, "customs", 1200);
    log.over(2000);
    log.mate(mate(3000));
    expect(log.raids[0].mates[0].points).toHaveLength(1);
    log.start(50_000, 200_000, "woods", 50_000);
    log.mate(mate(60_000));
    expect(log.raids[0].mates[0].points).toHaveLength(1);
  });

  it("saves a while after positions stop coming in", () => {
    log.start(1000, 90_000, "customs", 1000);
    log.own(pos, "customs", 1200);
    expect(saved).toHaveLength(0);
    vi.advanceTimersByTime(10_000);
    expect(saved).toHaveLength(1);
  });

  it("keeps the newest raids only", () => {
    for (let i = 0; i < MAX_RAIDS + 2; i++) {
      const at = 100_000 * (i + 1);
      log.start(at, at + 50_000, "customs", at);
      log.own(pos, "customs", at + 10);
      log.over(at + 20);
    }
    expect(log.raids).toHaveLength(MAX_RAIDS);
    expect(log.raids[0].startedAt).toBe(100_000 * (MAX_RAIDS + 2));
  });

  it("carries on an unfinished raid after a restart, and puts what was loaded under what was recorded", () => {
    const old = { ...startRaid("customs", 1000, 90_000), me: [{ t: 1200, ...pos }] };
    log.loaded([old]);
    log.start(1000, 90_000, "customs", 5000);
    log.own(pos, "customs", 5100);
    expect(log.raids).toHaveLength(1);
    expect(log.raids[0].me).toHaveLength(2);
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { retryUntil } from "./retry";

describe("retryUntil", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("retries on the interval until the attempt succeeds, then stops", async () => {
    let calls = 0;
    retryUntil(async () => ++calls >= 3, 10_000);
    expect(calls).toBe(0);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(calls).toBe(1);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(calls).toBe(3);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(calls).toBe(3);
  });

  it("stops when cancelled", async () => {
    let calls = 0;
    const stop = retryUntil(async () => {
      calls++;
      return false;
    }, 10_000);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(calls).toBe(1);
    stop();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(calls).toBe(1);
  });

  it("skips a tick while the previous attempt is still running and survives a rejection", async () => {
    let calls = 0;
    let release: (() => void) | null = null;
    retryUntil(() => {
      calls++;
      if (calls === 1) return new Promise<boolean>((resolve) => (release = () => resolve(false)));
      return Promise.reject(new Error("boom"));
    }, 10_000);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(calls).toBe(1);
    release!();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(calls).toBe(2);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(calls).toBe(3);
  });
});

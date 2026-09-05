import { describe, it, expect, vi, afterEach } from "vitest";
import { watchSize } from "./resize";

type Callback = () => void;

class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  observed: Element[] = [];
  disconnected = false;
  constructor(readonly cb: Callback) {
    FakeResizeObserver.instances.push(this);
  }
  observe(el: Element) {
    this.observed.push(el);
    // Browsers deliver one notification right after observe().
    this.cb();
  }
  disconnect() {
    this.disconnected = true;
  }
}

describe("watchSize", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    FakeResizeObserver.instances = [];
  });

  it("calls back on every size change after the initial notification, until stopped", () => {
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
    const el = document.createElement("div");
    const onResize = vi.fn();
    const stop = watchSize(el, onResize);
    const ro = FakeResizeObserver.instances[0];
    expect(ro.observed).toEqual([el]);
    expect(onResize).not.toHaveBeenCalled();
    ro.cb();
    ro.cb();
    expect(onResize).toHaveBeenCalledTimes(2);
    stop();
    expect(ro.disconnected).toBe(true);
  });

  it("is a no-op where ResizeObserver does not exist", () => {
    vi.stubGlobal("ResizeObserver", undefined);
    const stop = watchSize(document.createElement("div"), vi.fn());
    expect(() => stop()).not.toThrow();
  });
});

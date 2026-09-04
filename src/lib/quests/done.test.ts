import { describe, it, expect } from "vitest";
import { coerceDone, toggleDone } from "./done";

describe("toggleDone", () => {
  it("adds and removes ids without mutating the input", () => {
    const a: Record<string, true> = {};
    const b = toggleDone(a, "t1");
    expect(b).toEqual({ t1: true });
    expect(a).toEqual({});
    const c = toggleDone(b, "t1");
    expect(c).toEqual({});
    expect(b).toEqual({ t1: true });
  });
});

describe("coerceDone", () => {
  it("keeps object keys as done ids", () => {
    expect(coerceDone({ t1: true, t2: 1, t3: "x" })).toEqual({ t1: true, t2: true, t3: true });
  });

  it.each([[["t1"]], [null], ["t1"], [undefined], [7]])("rejects %s", (v) => {
    expect(coerceDone(v)).toEqual({});
  });
});

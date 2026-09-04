import { describe, it, expect } from "vitest";
import { toggleDone } from "./done";

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

import { describe, it, expect } from "vitest";
import { fitWidth, toBase64 } from "./shot";

describe("fitWidth", () => {
  it("scales a wide shot down to the width, keeping its shape", () => {
    expect(fitWidth(2560, 1440, 1280)).toEqual({ w: 1280, h: 720 });
    expect(fitWidth(3440, 1440, 1280)).toEqual({ w: 1280, h: 536 });
  });

  it("never scales up", () => {
    expect(fitWidth(800, 600, 1280)).toEqual({ w: 800, h: 600 });
  });
});

describe("toBase64", () => {
  it("matches btoa, also past one chunk", () => {
    const small = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2]);
    expect(toBase64(small)).toBe("/9j/4AEC");
    const big = new Uint8Array(100_000).map((_, i) => i % 251);
    let s = "";
    for (const b of big) s += String.fromCharCode(b);
    expect(toBase64(big)).toBe(btoa(s));
  });
});

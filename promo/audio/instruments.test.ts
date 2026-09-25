import { test } from "node:test";
import assert from "node:assert/strict";
import { biquad } from "./dsp.ts";
import { muffledTick } from "./instruments.ts";

test("muffled tick keeps its energy below 2 kHz", () => {
  const x = muffledTick();
  const hi = biquad(biquad(x, "highpass", 2000), "highpass", 2000);
  const energy = (b: Float32Array): number => b.reduce((s, v) => s + v * v, 0);
  assert.ok(energy(hi) < 0.1 * energy(x), `share above 2 kHz ${(energy(hi) / energy(x)).toFixed(3)}`);
});

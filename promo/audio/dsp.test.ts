import { test } from "node:test";
import assert from "node:assert/strict";
import { SR, biquad, dbToGain, envAD, limit, mix, noteHz, osc, secToSamples, stereo, wav24 } from "./dsp.ts";

test("note names map to Hz", () => {
  assert.ok(Math.abs(noteHz("A4") - 440) < 1e-9);
  assert.ok(Math.abs(noteHz("A1") - 55) < 1e-9);
  assert.ok(Math.abs(noteHz("E6") - 1318.51) < 0.01);
});

test("sine oscillator has the right period", () => {
  const s = osc("sine", 1000, 0.01);
  assert.equal(s.length, secToSamples(0.01));
  // 48 samples per cycle at 48 kHz / 1 kHz: peak at 12, zero crossing at 24.
  assert.ok(Math.abs(s[12] - 1) < 1e-3);
  assert.ok(Math.abs(s[24]) < 1e-3);
});

test("lowpass removes a tone far above cutoff", () => {
  const hi = osc("sine", 12000, 0.2);
  const out = biquad(hi, "lowpass", 200);
  const tail = out.slice(out.length / 2);
  const peak = Math.max(...Array.from(tail, Math.abs));
  assert.ok(peak < 0.01, `peak ${peak}`);
});

test("envAD starts at 0, peaks after attack, decays", () => {
  const b = envAD(new Float32Array(SR).fill(1), 0.01, 0.2);
  assert.equal(b[0], 0);
  assert.ok(b[secToSamples(0.01)] > 0.95);
  assert.ok(b[secToSamples(0.3)] < 0.01);
});

test("mix pans with equal power and unity at centre", () => {
  const dst = stereo(0.01);
  mix(dst, new Float32Array([1]), 0, 1, 0);
  assert.ok(Math.abs(dst.L[0] - 1) < 1e-6 && Math.abs(dst.R[0] - 1) < 1e-6);
  const hard = stereo(0.01);
  mix(hard, new Float32Array([1]), 0, 1, -1);
  assert.ok(hard.R[0] < 1e-6);
});

test("limit ramps into a sudden peak across the look-ahead and never exceeds the ceiling", () => {
  const n = secToSamples(0.3), at = secToSamples(0.05);
  const x = new Float32Array(n).fill(0.5);
  x[at] = 2;
  const st = { L: x.slice(), R: x.slice() };
  limit(st, -1);
  const ceil = dbToGain(-1), m = ceil / 2, la = secToSamples(0.002);
  const gain = (i: number): number => st.L[i] / x[i];
  let maxOut = 0, maxDrop = 0;
  for (let i = 0; i < n; i++) maxOut = Math.max(maxOut, Math.abs(st.L[i]), Math.abs(st.R[i]));
  for (let i = 1; i < n; i++) maxDrop = Math.max(maxDrop, gain(i - 1) - gain(i));
  assert.ok(maxOut <= ceil + 1e-6, `peak ${maxOut}`);
  assert.ok(maxDrop <= (1 - m) / la + 1e-6, `gain drops ${maxDrop} in one sample`);
  assert.ok(Math.abs(gain(at) - m) < 1e-4, `gain at the peak ${gain(at)}`);
  // The 80 ms release: 80 ms after the peak, 1/e of the reduction is left.
  assert.ok(Math.abs(gain(at + secToSamples(0.08)) - (1 - (1 - m) / Math.E)) < 1e-3);
});

test("limit leaves a buffer under the ceiling untouched", () => {
  const x = osc("sine", 440, 0.1);
  for (let i = 0; i < x.length; i++) x[i] *= 0.5;
  const st = { L: x.slice(), R: x.slice() };
  limit(st, -1);
  assert.deepEqual(st.L, x);
  assert.deepEqual(st.R, x);
});

test("wav24 writes a valid 24-bit stereo header and samples", () => {
  const one = { L: new Float32Array([1, -1]), R: new Float32Array([0, 0.5]) };
  const b = wav24(one);
  assert.equal(b.toString("ascii", 0, 4), "RIFF");
  assert.equal(b.toString("ascii", 8, 12), "WAVE");
  assert.equal(b.readUInt16LE(22), 2);
  assert.equal(b.readUInt32LE(24), SR);
  assert.equal(b.readUInt16LE(34), 24);
  assert.equal(b.readUInt32LE(40), 2 * 2 * 3);
  assert.equal(b.length, 44 + 12);
  assert.equal(b.readIntLE(44, 3), 8388607);
  assert.equal(b.readIntLE(47, 3), 0);
  assert.equal(b.readIntLE(50, 3), -8388607);
});

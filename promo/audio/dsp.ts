import { rng } from "../src/lib/random.ts";

export const SR = 48000;
export type Stereo = { L: Float32Array; R: Float32Array };
/** Frequency: constant, or a function of seconds since the sound started. */
export type Freq = number | ((t: number) => number);

export const secToSamples = (s: number): number => Math.round(s * SR);
export const stereo = (seconds: number): Stereo => {
  const n = secToSamples(seconds);
  return { L: new Float32Array(n), R: new Float32Array(n) };
};
export const dbToGain = (db: number): number => 10 ** (db / 20);
export const midiToHz = (m: number): number => 440 * 2 ** ((m - 69) / 12);
const PITCH: Record<string, number> = { C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11 };
/** "A4" -> 440 Hz. */
export function noteHz(name: string): number {
  const m = /^([A-G](?:#|b)?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`bad note ${name}`);
  return midiToHz(PITCH[m[1]] + (Number(m[2]) + 1) * 12);
}
const f = (fr: Freq, t: number): number => (typeof fr === "number" ? fr : fr(t));

function polyBlep(t: number, dt: number): number {
  if (t < dt) { t /= dt; return t + t - t * t - 1; }
  if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; }
  return 0;
}

/** Band-limited oscillator (polyBLEP saw/square). */
export function osc(shape: "sine" | "saw" | "square" | "tri", freq: Freq, seconds: number, phase0 = 0): Float32Array {
  const n = secToSamples(seconds);
  const out = new Float32Array(n);
  let ph = phase0 % 1;
  let tri = 0;
  for (let i = 0; i < n; i++) {
    const hz = Math.max(0, f(freq, i / SR));
    const dt = Math.min(0.5, hz / SR);
    let v: number;
    if (shape === "sine") v = Math.sin(2 * Math.PI * ph);
    else if (shape === "saw") v = 2 * ph - 1 - polyBlep(ph, dt);
    else {
      let sq = (ph < 0.5 ? 1 : -1) + polyBlep(ph, dt) - polyBlep((ph + 0.5) % 1, dt);
      if (shape === "tri") { tri = dt * sq * 4 + (1 - dt * 0.5) * tri; sq = tri; }
      v = sq;
    }
    out[i] = v;
    ph += dt;
    if (ph >= 1) ph -= 1;
  }
  return out;
}

export function noise(seconds: number, seed = 1): Float32Array {
  const r = rng(seed);
  const out = new Float32Array(secToSamples(seconds));
  for (let i = 0; i < out.length; i++) out[i] = r() * 2 - 1;
  return out;
}

/** In place: linear attack, optional hold, exponential decay reaching -60 dB after `decay` seconds. */
export function envAD(buf: Float32Array, attack: number, decay: number, hold = 0): Float32Array {
  const a = Math.max(1, secToSamples(attack)), h = secToSamples(hold);
  const k = Math.log(1000) / Math.max(1, secToSamples(decay));
  for (let i = 0; i < buf.length; i++) {
    const g = i < a ? i / a : i < a + h ? 1 : Math.exp(-k * (i - a - h));
    buf[i] *= g;
  }
  return buf;
}

/** In place: ADSR with the release starting at `gate` seconds. */
export function envADSR(buf: Float32Array, a: number, d: number, s: number, r: number, gate: number): Float32Array {
  const A = Math.max(1, secToSamples(a)), D = Math.max(1, secToSamples(d)), G = secToSamples(gate), R = Math.max(1, secToSamples(r));
  let atGate = s;
  for (let i = 0; i < buf.length; i++) {
    let g: number;
    if (i < G) {
      g = i < A ? i / A : i < A + D ? 1 - (1 - s) * ((i - A) / D) : s;
      atGate = g;
    } else g = atGate * Math.max(0, 1 - (i - G) / R);
    buf[i] *= g;
  }
  return buf;
}

/** In place: short linear fades so a buffer never starts or stops with a click. */
export function fade(buf: Float32Array, fin = 0.002, fout = 0.005): Float32Array {
  const a = secToSamples(fin), b = secToSamples(fout);
  for (let i = 0; i < a && i < buf.length; i++) buf[i] *= i / a;
  for (let i = 0; i < b && i < buf.length; i++) buf[buf.length - 1 - i] *= i / b;
  return buf;
}

export type FilterType = "lowpass" | "highpass" | "bandpass" | "peak";
/** RBJ biquad; coefficients follow a time-varying cutoff every 16 samples. Returns a new buffer. */
export function biquad(buf: Float32Array, type: FilterType, cutoff: Freq, q = 0.707, gainDb = 0): Float32Array {
  const out = new Float32Array(buf.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  let b0 = 0, b1 = 0, b2 = 0, a1 = 0, a2 = 0;
  for (let i = 0; i < buf.length; i++) {
    if (i % 16 === 0) {
      const f0 = Math.min(SR * 0.45, Math.max(10, f(cutoff, i / SR)));
      const w = (2 * Math.PI * f0) / SR, cw = Math.cos(w), sw = Math.sin(w), al = sw / (2 * q);
      let n0: number, n1: number, n2: number, d0: number, d1: number, d2: number;
      if (type === "lowpass") { n0 = (1 - cw) / 2; n1 = 1 - cw; n2 = n0; d0 = 1 + al; d1 = -2 * cw; d2 = 1 - al; }
      else if (type === "highpass") { n0 = (1 + cw) / 2; n1 = -(1 + cw); n2 = n0; d0 = 1 + al; d1 = -2 * cw; d2 = 1 - al; }
      else if (type === "bandpass") { n0 = al; n1 = 0; n2 = -al; d0 = 1 + al; d1 = -2 * cw; d2 = 1 - al; }
      else { const A = 10 ** (gainDb / 40); n0 = 1 + al * A; n1 = -2 * cw; n2 = 1 - al * A; d0 = 1 + al / A; d1 = -2 * cw; d2 = 1 - al / A; }
      b0 = n0 / d0; b1 = n1 / d0; b2 = n2 / d0; a1 = d1 / d0; a2 = d2 / d0;
    }
    const x = buf[i];
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    out[i] = y;
  }
  return out;
}

/** Add mono `src` into `dst` at `atSec` with equal-power pan (-1 left, 1 right; unity at centre). */
export function mix(dst: Stereo, src: Float32Array, atSec: number, gain = 1, pan = 0): void {
  const start = secToSamples(atSec);
  const a = ((Math.max(-1, Math.min(1, pan)) + 1) * Math.PI) / 4;
  const gl = Math.cos(a) * Math.SQRT2 * gain, gr = Math.sin(a) * Math.SQRT2 * gain;
  for (let i = 0; i < src.length; i++) {
    const j = start + i;
    if (j < 0 || j >= dst.L.length) continue;
    dst.L[j] += src[i] * gl;
    dst.R[j] += src[i] * gr;
  }
}

export function mixStereo(dst: Stereo, src: Stereo, atSec: number, gain = 1): void {
  const start = secToSamples(atSec);
  for (let i = 0; i < src.L.length; i++) {
    const j = start + i;
    if (j < 0 || j >= dst.L.length) continue;
    dst.L[j] += src.L[i] * gain;
    dst.R[j] += src.R[i] * gain;
  }
}

/** Ping-pong delay: returns dry + echoes, echoes alternating right/left. */
export function pingPong(src: Float32Array, delaySec: number, feedback: number, wet: number, tailSec = 1.5): Stereo {
  const d = secToSamples(delaySec);
  const n = src.length + secToSamples(tailSec);
  const out: Stereo = { L: new Float32Array(n), R: new Float32Array(n) };
  for (let i = 0; i < src.length; i++) { out.L[i] += src[i]; out.R[i] += src[i]; }
  let g = wet;
  for (let k = 1; g > 0.001 && k * d < n; k++, g *= feedback) {
    const ch = k % 2 === 1 ? out.R : out.L;
    for (let i = 0; i < src.length && i + k * d < n; i++) ch[i + k * d] += src[i] * g;
  }
  return out;
}

const COMBS = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
const ALLPASSES = [556, 441, 341, 225];
/** Freeverb-style stereo reverb. Returns a new buffer (input length + tail). */
export function reverb(src: Stereo, opts: { room?: number; damp?: number; wet?: number; dry?: number; tail?: number } = {}): Stereo {
  const { room = 0.84, damp = 0.3, wet = 0.3, dry = 1, tail = 2 } = opts;
  const n = src.L.length + secToSamples(tail);
  const out: Stereo = { L: new Float32Array(n), R: new Float32Array(n) };
  const scale = SR / 44100;
  for (const [ch, spread] of [["L", 0], ["R", 23]] as const) {
    const input = src[ch];
    const acc = new Float32Array(n);
    for (const len0 of COMBS) {
      const len = Math.round((len0 + spread) * scale);
      const buf = new Float32Array(len);
      let idx = 0, store = 0;
      for (let i = 0; i < n; i++) {
        const x = i < input.length ? input[i] * 0.015 : 0;
        const y = buf[idx];
        store = y * (1 - damp) + store * damp;
        buf[idx] = x + store * room;
        idx = (idx + 1) % len;
        acc[i] += y;
      }
    }
    for (const len0 of ALLPASSES) {
      const len = Math.round((len0 + spread) * scale);
      const buf = new Float32Array(len);
      let idx = 0;
      for (let i = 0; i < n; i++) {
        const b = buf[idx];
        const y = -acc[i] + b;
        buf[idx] = acc[i] + b * 0.5;
        idx = (idx + 1) % len;
        acc[i] = y;
      }
    }
    const o = out[ch];
    for (let i = 0; i < n; i++) o[i] = acc[i] * wet * 3 + (i < input.length ? input[i] * dry : 0);
  }
  return out;
}

export const softClip = (x: number, drive = 1): number => Math.tanh(x * drive) / Math.tanh(drive);

/** Peak limiter with 2 ms look-ahead and 80 ms release. In place. */
export function limit(st: Stereo, ceilingDb = -1): void {
  const ceil = dbToGain(ceilingDb), la = secToSamples(0.002), rel = Math.exp(-1 / secToSamples(0.08));
  const n = st.L.length;
  const need = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const p = Math.max(Math.abs(st.L[i]), Math.abs(st.R[i]));
    need[i] = p > ceil ? ceil / p : 1;
  }
  let g = 1;
  for (let i = 0; i < n; i++) {
    let m = 1;
    for (let k = 0; k <= la && i + k < n; k++) m = Math.min(m, need[i + k]);
    g = m < g ? m : m - (m - g) * rel;
    st.L[i] *= g;
    st.R[i] *= g;
  }
}

/** 24-bit PCM stereo WAV. */
export function wav24(st: Stereo): Buffer {
  const n = st.L.length, bytes = n * 6;
  const b = Buffer.alloc(44 + bytes);
  b.write("RIFF", 0, "ascii"); b.writeUInt32LE(36 + bytes, 4); b.write("WAVE", 8, "ascii");
  b.write("fmt ", 12, "ascii"); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(2, 22);
  b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 6, 28); b.writeUInt16LE(6, 32); b.writeUInt16LE(24, 34);
  b.write("data", 36, "ascii"); b.writeUInt32LE(bytes, 40);
  let o = 44;
  for (let i = 0; i < n; i++) {
    for (const ch of [st.L, st.R]) {
      const v = Math.max(-1, Math.min(1, ch[i]));
      b.writeIntLE(Math.round(v * 8388607), o, 3);
      o += 3;
    }
  }
  return b;
}

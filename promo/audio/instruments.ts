/**
 * The score's instruments, built only from dsp.ts. Each returns a mono buffer (or Stereo where noted),
 * starting and ending with a fade so nothing clicks. Levels in dB follow the recipe in the task brief.
 */
import { BPM } from "../src/timeline.ts";
import { rng } from "../src/lib/random.ts";
import { SR, biquad, dbToGain, envAD, envADSR, fade, midiToHz, mix, mixStereo, noise, noteHz, osc, pingPong, reverb, secToSamples, softClip, stereo } from "./dsp.ts";
import type { Freq, Stereo } from "./dsp.ts";

const BEAT = 60 / BPM;

// ---- plumbing ----

const silence = (seconds: number): Float32Array => new Float32Array(secToSamples(seconds));
/** Adds `src` into `dst` at `atSec`. Returns `dst`. */
function add(dst: Float32Array, src: Float32Array, atSec = 0, gain = 1): Float32Array {
  const s = secToSamples(atSec);
  for (let i = 0; i < src.length && s + i < dst.length; i++) dst[s + i] += src[i] * gain;
  return dst;
}
/** In place: multiply by a constant or by a function of seconds. */
function amp(buf: Float32Array, g: number | ((t: number) => number)): Float32Array {
  for (let i = 0; i < buf.length; i++) buf[i] *= typeof g === "number" ? g : g(i / SR);
  return buf;
}
/** A mono buffer as a (read-only) centred stereo source for reverb. */
const asStereo = (buf: Float32Array): Stereo => ({ L: buf, R: buf });
function fadeSt(st: Stereo, fin?: number, fout?: number): Stereo {
  fade(st.L, fin, fout);
  if (st.R !== st.L) fade(st.R, fin, fout);
  return st;
}

// ---- drums and music ----

export function kick(): Float32Array {
  const v = envAD(osc("sine", (t) => 45 + 105 * Math.exp(-t / 0.045), 0.45), 0.001, 0.38);
  add(v, envAD(biquad(noise(0.003, 11), "highpass", 2000), 0.0002, 0.003), 0, dbToGain(-14));
  for (let i = 0; i < v.length; i++) v[i] = softClip(v[i], 1.6);
  return fade(v, 0.0005);
}

export function clap(): Stereo {
  const src = noise(0.25, 21);
  const v = silence(0.25);
  for (const at of [0, 0.011, 0.022]) {
    const s = secToSamples(at);
    add(v, fade(envAD(src.slice(s, s + secToSamples(0.008)), 0.0003, 0.016), 0.0003, 0.002), at);
  }
  add(v, envAD(src.slice(secToSamples(0.022)), 0.001, 0.18), 0.022, 0.8);
  const bp = fade(biquad(v, "bandpass", 1300, 0.9), 0.0005, 0.01);
  return fadeSt(reverb(asStereo(bp), { room: 0.6, wet: 0.18, tail: 0.5 }), 0, 0.05);
}

/** Plus a 12 kHz lowpass (not in the recipe): white noise left open to 24 kHz was an energy wall up top. */
export function hat(open = false): Float32Array {
  const d = open ? 0.28 : 0.045;
  const v = envAD(biquad(biquad(noise(d + 0.005, open ? 32 : 31), "highpass", 7500), "lowpass", 12000), 0.001, d);
  return fade(amp(v, dbToGain(-8)), 0.0005);
}

/**
 * Bar-1 pulse: the hat's short envelope on noise kept under ~2 kHz (three 1.6 kHz lowpasses), with a
 * little low body on A2, the pad's root.
 */
export function muffledTick(): Float32Array {
  let v = noise(0.07, 33);
  for (let s = 0; s < 3; s++) v = biquad(v, "lowpass", 1600);
  envAD(v, 0.001, 0.045);
  add(v, envAD(osc("sine", noteHz("A2"), 0.07), 0.002, 0.06), 0, dbToGain(-24));
  return fade(v, 0.0005);
}

/**
 * Reese bass note. `t0` is the note's start in the song: the oscillators run free across notes, so the
 * detuned saws keep drifting against each other instead of restarting in phase on every 8th.
 */
export function bass(hz: number, dur: number, t0 = 0): Float32Array {
  const len = dur + 0.04, det = 2 ** (7 / 1200);
  const ph = (h: number) => (h * t0) % 1;
  const v = osc("saw", hz * det, len, ph(hz * det));
  add(v, osc("saw", hz / det, len, ph(hz / det)));
  add(v, osc("sine", hz / 2, len, ph(hz / 2)), 0, dbToGain(-3));
  const out = biquad(v, "lowpass", (t) => 300 + 700 * Math.exp(-t / 0.08), 1.1);
  envADSR(out, 0.004, 0.1, 0.8, 0.04, dur);
  return fade(amp(out, 0.4));
}

/** Stereo. Lowest voice nearest the centre, higher voices spread out to +-0.6. */
export function padChord(notes: readonly string[], dur: number): Stereo {
  const len = dur + 1.2;
  const r = rng(7);
  const pans = notes
    .map((_, i) => (notes.length > 1 ? -0.6 + (1.2 * i) / (notes.length - 1) : 0))
    .sort((a, b) => Math.abs(a) - Math.abs(b) || a - b);
  const dry = stereo(len);
  notes.forEach((n, i) => {
    const hz = noteHz(n);
    const v = silence(len);
    for (const cents of [-12, 0, 12]) add(v, osc("saw", hz * 2 ** (cents / 1200), len, r()), 0, 1 / 3);
    const lp = biquad(v, "lowpass", (t) => 1100 + 350 * Math.sin(2 * Math.PI * 0.2 * t));
    envADSR(lp, 1.2, 0.5, 0.85, 1.2, dur);
    mix(dry, fade(lp), 0, 1 / Math.sqrt(notes.length), pans[i]);
  });
  return fadeSt(reverb(dry, { room: 0.9, damp: 0.4, wet: 0.35, tail: 2.5 }), 0, 0.3);
}

/** Stereo. */
export function pluck(hz: number): Stereo {
  const len = 0.36;
  const v = amp(osc("saw", hz, len), 0.6);
  add(v, osc("square", hz, len), 0, 0.4);
  const lp = biquad(v, "lowpass", (t) => 600 + 3400 * Math.exp(-t / 0.08));
  envAD(lp, 0.002, 0.35);
  return fadeSt(pingPong(fade(lp), 0.375, 0.35, 0.35), 0, 0.05);
}

/** Stereo. `len` scales the whole hit (impactLite is 0.6 s). */
export function impact(gain = 1, len = 1.2): Stereo {
  const k = len / 1.2;
  const v = envAD(osc("sine", (t) => 30 + 60 * Math.exp(-t / 0.15), len), 0.002, 0.9 * k);
  add(v, envAD(biquad(noise(len, 41), "lowpass", 800), 0.001, 0.4 * k), 0, dbToGain(-6));
  for (let i = 0; i < v.length; i++) v[i] = softClip(v[i], 2) * gain;
  return fadeSt(reverb(asStereo(fade(v, 0.0005, 0.02)), { room: 0.92, wet: 0.5, tail: 2.5 }), 0, 0.3);
}

export const impactLite = (): Stereo => impact(0.5, 0.6);

/** Stereo. Plus a 12 kHz lowpass on the mix (not in the recipe), as for the hat. */
export function crash(): Stereo {
  const n = noise(1.85, 51);
  const v = biquad(n, "highpass", 3000);
  add(v, biquad(n, "bandpass", 7000, 0.5));
  const lp = envAD(biquad(v, "lowpass", 12000), 0.001, 1.8);
  return fadeSt(reverb(asStereo(fade(amp(lp, 0.5), 0.0005, 0.05)), { wet: 0.25 }), 0, 0.3);
}

/** Stereo: impact + crash + sub drop. */
export function finalHit(): Stereo {
  const hit = impact(), cr = crash();
  const sub = envAD(osc("sine", (t) => 25 + 35 * Math.exp(-t / 0.4), 2), 0.003, 2);
  const out = stereo(Math.max(hit.L.length, cr.L.length) / SR);
  mixStereo(out, hit, 0);
  mixStereo(out, cr, 0, dbToGain(-3));
  mix(out, fade(sub), 0, dbToGain(-3));
  return out;
}

// ---- transitions ----

/** Ends exactly at `dur`. */
export function riser(dur: number): Float32Array {
  const v = biquad(noise(dur, 61), "bandpass", (t) => 300 * (8000 / 300) ** (t / dur), 1.4);
  add(v, biquad(osc("saw", (t) => noteHz("A3") * 2 ** (t / dur), dur), "lowpass", 2000), 0, dbToGain(-12));
  return fade(amp(v, (t) => (t / dur) ** 2));
}

/** Stereo, panned from -pan to +pan. */
export function whoosh(dur: number, pan: number): Stereo {
  const cut = (t: number): number => {
    const u = t / dur;
    return u < 0.4 ? 500 * 6 ** (u / 0.4) : 3000 * (800 / 3000) ** ((u - 0.4) / 0.6);
  };
  const v = biquad(noise(dur, 71), "bandpass", cut, 1);
  const out = stereo(dur);
  for (let i = 0; i < v.length; i++) {
    const u = i / v.length;
    const a = ((Math.max(-1, Math.min(1, -pan + 2 * pan * u)) + 1) * Math.PI) / 4;
    const x = v[i] * Math.sin(Math.PI * u) ** 2;
    out.L[i] = x * Math.cos(a) * Math.SQRT2;
    out.R[i] = x * Math.sin(a) * Math.SQRT2;
  }
  return fadeSt(out);
}

// ---- UI sounds ----

/** Sine tuned to A6 (recipe: 1800 Hz) so it sits in the key. */
export function keyClick(): Float32Array {
  const v = envAD(osc("sine", noteHz("A6"), 0.02), 0.0005, 0.015);
  add(v, fade(biquad(noise(0.002, 81), "highpass", 3000), 0.0002, 0.001), 0, 0.5);
  return fade(amp(v, dbToGain(-6)), 0.0002, 0.003);
}

export function shutter(): Float32Array {
  const burst = (len: number, seed: number, hz: Freq): Float32Array =>
    fade(envAD(biquad(noise(len, seed), "bandpass", hz, 1), 0.0005, 2 * len), 0.0003, 0.002);
  const v = silence(0.125);
  add(v, burst(0.012, 91, 4000));
  add(v, burst(0.01, 92, 3000), 0.1);
  add(v, burst(0.02, 93, (t) => 2000 * 3 ** (t / 0.02)), 0.1, dbToGain(-10));
  return fade(v, 0.0003);
}

/** Blip pitches: the A minor pentatonic between 2 and 6 kHz. */
const CHIRP_HZ = Array.from({ length: 128 }, (_, m) => m)
  .filter((m) => [0, 3, 5, 7, 10].includes((m + 3) % 12))
  .map(midiToHz)
  .filter((hz) => hz >= 2000 && hz <= 6000);

/** Stereo. */
export function chirps(dur: number, seed: number): Stereo {
  const r = rng(seed);
  const out = stereo(dur + 0.04);
  for (let t = 0; t < dur; t += 0.025 + 0.02 * r()) {
    const len = 0.015 + 0.015 * r();
    const blip = envAD(osc("square", CHIRP_HZ[Math.floor(r() * CHIRP_HZ.length)], len), 0.001, 0.02);
    mix(out, fade(blip, 0.0005, 0.003), t, dbToGain(-14), r() * 2 - 1);
  }
  return out;
}

/** Stereo. */
export function ping(): Stereo {
  const v = osc("sine", noteHz("E6"), 1.45);
  add(v, osc("sine", noteHz("E7"), 1.45), 0, dbToGain(-14));
  envAD(v, 0.002, 1.4);
  return fadeSt(reverb(pingPong(fade(v), 0.375, 0.45, 0.5, 2), { room: 0.9, wet: 0.35 }), 0, 0.3);
}

/**
 * `decay` 20 ms (recipe: 6 ms) so the tick carries its note and reaches its level without a full-scale
 * peak; the ratchet keeps 6 ms ticks.
 */
export function tick(hz: number, decay = 0.02): Float32Array {
  const v = envAD(osc("sine", hz, decay), 0.0005, decay);
  add(v, fade(biquad(noise(0.003, 101), "highpass", 5000), 0.0002, 0.001), 0, dbToGain(-12));
  return fade(v, 0.0002, 0.001);
}

export function pop(hz: number): Float32Array {
  const v = envAD(osc("sine", (t) => hz * 1.5 ** Math.min(1, t / 0.04), 0.09), 0.001, 0.08);
  return fade(amp(v, dbToGain(-6)), 0.0005);
}

/** Sine tuned to E2 (recipe: 70 Hz), a note of every chord in the progression. */
export function thud(): Float32Array {
  const v = envAD(osc("sine", noteHz("E2"), 0.2), 0.002, 0.18);
  add(v, envAD(biquad(noise(0.07, 111), "lowpass", 300), 0.001, 0.06), 0, dbToGain(-10));
  return fade(v, 0.0005);
}

export function uiClick(): Float32Array {
  const v = tick(2000);
  add(v, fade(biquad(noise(0.005, 121), "bandpass", 2500), 0.0003, 0.002));
  return amp(v, dbToGain(-6));
}

/** Stereo. */
export function stab(notes: readonly string[]): Stereo {
  const r = rng(13);
  const v = silence(0.32);
  for (const n of notes) add(v, osc("saw", noteHz(n), 0.32, r()), 0, 1 / notes.length);
  const lp = biquad(v, "lowpass", (t) => 500 + 4000 * Math.exp(-t / 0.06));
  envAD(lp, 0.002, 0.3);
  return fadeSt(reverb(asStereo(fade(lp)), { wet: 0.25 }), 0, 0.3);
}

export function dashTicks(dur: number): Float32Array {
  const v = silence(dur + 0.01);
  for (let t = 0; t < dur - 1e-9; t += BEAT / 8) add(v, tick(1500 * 2 ** (t / dur)), t);
  return v;
}

/** Tuned to E7 / E6 (recipe: 2600 / 1300 Hz). */
export function checkTick(): Float32Array {
  const v = silence(0.1);
  add(v, tick(noteHz("E7")));
  return add(v, pop(noteHz("E6")), 0, dbToGain(-6));
}

export function scribble(dur: number, seed: number): Float32Array {
  const r = rng(seed);
  const wob = Array.from({ length: Math.ceil(dur * 15) + 2 }, () => r() * 2 - 1);
  const cut = (t: number): number => {
    const x = t * 15, i = Math.floor(x), u = x - i, s = u * u * (3 - 2 * u);
    return 1800 + 600 * (wob[i] + (wob[i + 1] - wob[i]) * s);
  };
  const v = biquad(noise(dur, seed), "bandpass", cut, 1.5);
  let ph = 0, rate = 20 + 20 * r(), lvl = 0.5 + 0.5 * r();
  for (let i = 0; i < v.length; i++) {
    v[i] *= lvl * (0.5 - 0.5 * Math.cos(2 * Math.PI * ph));
    ph += rate / SR;
    if (ph >= 1) { ph -= 1; rate = 20 + 20 * r(); lvl = 0.5 + 0.5 * r(); }
  }
  return fade(amp(v, dbToGain(-10)));
}

export function glitch(): Float32Array {
  const v = silence(0.08);
  for (let k = 0; k < 3; k++) {
    const c = noise(0.02, 131 + k);
    add(c, osc("square", noteHz("A3"), 0.02));
    add(v, fade(amp(c, 0.5), 0.001, 0.002), k * 0.03);
  }
  return v;
}

/** Plus an 8 kHz lowpass (not in the recipe): 72 noise-topped ticks at 180 Hz buzz up to 24 kHz. */
export function ratchet(dur: number): Float32Array {
  const v = silence(dur + 0.01);
  for (let k = 0; k < 72; k++) add(v, tick(1500 * (3500 / 1500) ** (k / 71), 0.006), (k / 72) * dur);
  return fade(biquad(v, "lowpass", 8000), 0, 0.005);
}

/** Stereo: claps on 8ths for the first half, 16ths for the next quarter, 32nds to the end. */
export function snareRoll(dur: number): Stereo {
  const c = clap();
  const hits: number[] = [];
  for (let t = 0; t < dur - 1e-9; t += t < dur / 2 - 1e-9 ? BEAT / 2 : t < (3 * dur) / 4 - 1e-9 ? BEAT / 4 : BEAT / 8) hits.push(t);
  const last = hits[hits.length - 1] || 1;
  const out = stereo(dur + c.L.length / SR);
  for (const t of hits) mixStereo(out, c, t, dbToGain(-18 + 14 * (t / last)));
  return out;
}

/** Stereo. */
export function shimmer(dur: number, seed: number): Stereo {
  const r = rng(seed);
  const len = dur + 0.4;
  const v = silence(len);
  for (const n of ["A6", "E7", "A7"]) {
    const rate = 6 + 3 * r(), ph = r();
    const s = osc("sine", noteHz(n), len, r());
    add(v, amp(s, (t) => 0.75 + 0.25 * Math.sin(2 * Math.PI * (rate * t + ph))), 0, 1 / 3);
  }
  envADSR(v, 0.05, 0.2, 0.7, 0.4, dur);
  return fadeSt(reverb(asStereo(fade(v)), { wet: 0.5 }), 0, 0.3);
}

/** Stereo. */
export function typing(dur: number, seed: number): Stereo {
  const r = rng(seed);
  const kc = keyClick();
  const out = stereo(dur + 0.03);
  for (let t = 0, k = 0; t < dur; t += 0.045 + 0.035 * r(), k++) mix(out, kc, t, dbToGain(-8), k % 2 === 0 ? -0.2 : 0.2);
  return out;
}

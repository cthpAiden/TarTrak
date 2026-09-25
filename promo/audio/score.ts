/**
 * The arrangement: a 15 s, 120 BPM groove in A minor plus one sound per cue in the shared timeline, so
 * every hit lands on the frame its picture does. Beat k starts at k * 0.5 s.
 */
import { BPM, CUES, DURATION_FRAMES, frameToSec } from "../src/timeline.ts";
import type { Cue, CueKind } from "../src/timeline.ts";
import { SR, biquad, dbToGain, limit, mix, mixStereo, noteHz, secToSamples, softClip, stereo } from "./dsp.ts";
import type { Stereo } from "./dsp.ts";
import * as I from "./instruments.ts";

const LEN = frameToSec(DURATION_FRAMES);
const BEAT = 60 / BPM, BAR = 4 * BEAT;

const AM9 = ["A2", "E3", "G3", "B3", "C4"];
/** Chords by bar (index 0 = bar 1 = 0-2 s); the last one holds to the end. */
const CHORDS: readonly (readonly string[])[] = [AM9, AM9, ["F2", "C3", "E3", "A3"], ["C3", "G3", "D4", "E4"], ["G2", "D3", "E3", "B3"], AM9, AM9];
/** Bass roots by bar (bars 2-6 play). */
const ROOTS = ["A1", "A1", "F1", "C2", "G1", "A1"];
const barAt = (sec: number): number => Math.min(CHORDS.length - 1, Math.floor(sec / BAR + 1e-9));

/**
 * Mix levels in dB, set by measurement (K-weighted 50 ms / 400 ms loudness per element). The muffled
 * bar-1 ticks are clear while the pad fades in and sit under it from about 1 s.
 */
const DB = { kick: -6, hat: 4, openHat: 0, clap: 3, bass: -8, padStart: -30, pad: -18, muffledTick: 2, master: -4.5 };
/**
 * Per-kind trims in dB, on top of each cue's own gain, set by measurement: UI sounds clear the music in
 * their own octave band, impacts are the loudest moments. impactLite shares the impact trim (it is the
 * 0.5-gain impact); the snare roll ends at a groove clap's level.
 */
const CUE_DB: Record<CueKind, number> = {
  uiClick: 1.5, pop: 4, keyClick: 4.5, shutter: 4, chirps: 4, pluck: 4, riser: -6, whoosh: -4,
  impact: -3, impactLite: -3, finalHit: -4.5, crash: -8, ping: -8.5, tick: -1, thud: -4, stab: 2.5,
  dashTicks: 0, checkTick: -1, scribble: 12, glitch: -7.5, ratchet: -5, snareRoll: DB.clap + 4, shimmer: -14, typing: 4.5,
};

/** One sound per cue kind; `dur` in seconds. */
const CUE_SOUND: Record<CueKind, (c: Cue, dur: number) => Float32Array | Stereo> = {
  uiClick: () => I.uiClick(),
  pop: (c) => I.pop(noteHz(c.note ?? "A5")),
  keyClick: () => I.keyClick(),
  shutter: () => I.shutter(),
  chirps: (c, d) => I.chirps(d, c.at),
  pluck: (c) => I.pluck(noteHz(c.note ?? "A4")),
  riser: (_, d) => I.riser(d),
  whoosh: (c, d) => I.whoosh(d, c.pan ?? 0),
  impact: () => I.impact(),
  impactLite: () => I.impactLite(),
  finalHit: () => I.finalHit(),
  crash: () => I.crash(),
  ping: () => I.ping(),
  tick: (c) => I.tick(noteHz(c.note ?? "E6")),
  thud: () => I.thud(),
  stab: (c) => I.stab(CHORDS[barAt(frameToSec(c.at))]),
  dashTicks: (_, d) => I.dashTicks(d),
  checkTick: () => I.checkTick(),
  scribble: (c, d) => I.scribble(d, c.at),
  glitch: () => I.glitch(),
  ratchet: (_, d) => I.ratchet(d),
  snareRoll: (_, d) => I.snareRoll(d),
  shimmer: (c, d) => I.shimmer(d, c.at),
  typing: (c, d) => I.typing(d, c.at),
};

/** Sidechain gain: -6 dB after each kick (reached over 5 ms, so the duck never steps), 0.12 s recovery. */
function duckCurve(kicks: readonly number[], n: number): Float32Array {
  const g = new Float32Array(n).fill(1);
  const att = 0.005;
  for (const tk of kicks) {
    const s = secToSamples(tk);
    for (let i = 0; i < SR && s + i < n; i++) {
      const t = i / SR;
      g[s + i] *= 1 - 0.5 * Math.min(1, t / att) * Math.exp(-Math.max(0, t - att) / 0.12);
    }
  }
  return g;
}

type Buses = { drums: Stereo; bass: Stereo; pad: Stereo; sfx: Stereo };

function renderBuses(): Buses {
  const drums = stereo(LEN), bass = stereo(LEN), pad = stereo(LEN), sfx = stereo(LEN);
  const n = drums.L.length;
  const kick = I.kick(), hat = I.hat(), openHat = I.hat(true), clap = I.clap();

  // Bar 1: muffled 8th ticks.
  const muffled = I.muffledTick();
  for (let e = 0; e < 8; e++) mix(drums, muffled, (e * BEAT) / 2, dbToGain(DB.muffledTick));

  // Bars 2-6 (index 1-5): kick 4/4, bass 8ths, hats, claps.
  const kicks: number[] = [];
  for (let b = 1; b <= 5; b++) {
    const t0 = b * BAR;
    for (let q = 0; q < 4; q++) {
      const t = t0 + q * BEAT;
      kicks.push(t);
      mix(drums, kick, t, dbToGain(DB.kick));
      const open = q === 3 && (b === 3 || b === 5);
      mix(drums, open ? openHat : hat, t + BEAT / 2, dbToGain(open ? DB.openHat : DB.hat));
      if (b >= 2 && (q === 1 || q === 3)) mixStereo(drums, clap, t, dbToGain(DB.clap));
      const extra = b === 2 ? -6 : b >= 4 ? -2 : null;
      if (extra !== null) for (const s of [1, 3]) mix(drums, hat, t + (s * BEAT) / 4, dbToGain(DB.hat + extra));
    }
    for (let e = 0; e < 8; e++) {
      const t = t0 + (e * BEAT) / 2;
      const hz = noteHz(ROOTS[b]) * (e === 7 ? 2 : 1);
      // Gate plus the 40 ms release fill the 8th exactly, so notes never overlap.
      mix(bass, I.bass(hz, BEAT / 2 - 0.04, t), t, dbToGain(DB.bass + (e === 0 || e === 4 ? 3 : 0)));
    }
  }

  // Pad: one chord per bar, -30 dB rising to -18 dB over bar 1.
  for (let b = 0; b < CHORDS.length; b++) {
    const last = b === CHORDS.length - 1;
    mixStereo(pad, I.padChord(CHORDS[b], last ? LEN - b * BAR : BAR), b * BAR);
  }
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const g = dbToGain(t < BAR ? DB.padStart + ((DB.pad - DB.padStart) * t) / BAR : DB.pad);
    pad.L[i] *= g;
    pad.R[i] *= g;
  }

  // Sidechain: the kick ducks bass and pad.
  const duck = duckCurve(kicks, n);
  for (const bus of [bass, pad]) {
    for (let i = 0; i < n; i++) {
      bus.L[i] *= duck[i];
      bus.R[i] *= duck[i];
    }
  }

  // One sound per cue.
  for (const c of CUES) {
    const s = cueSound(c);
    if (s instanceof Float32Array) mix(sfx, s, frameToSec(c.at), 1, c.pan ?? 0);
    else mixStereo(sfx, s, frameToSec(c.at));
  }
  return { drums, bass, pad, sfx };
}

/** One cue's sound at its mix level (cue gain and kind trim applied). */
function cueSound(c: Cue): Float32Array | Stereo {
  const s = CUE_SOUND[c.kind](c, frameToSec(c.dur ?? 0));
  const g = (c.gain ?? 1) * dbToGain(CUE_DB[c.kind]);
  for (const ch of s instanceof Float32Array ? [s] : [s.L, s.R]) for (let i = 0; i < ch.length; i++) ch[i] *= g;
  return s;
}

const END_FADE = 0.8;

/**
 * Sum, highpass 25 Hz, mono below ~120 Hz, soft clip, lowpass 17 kHz, fade the last 0.8 s to silence,
 * limit at -1 dBFS.
 */
export function renderScore(): Stereo {
  const { drums, bass, pad, sfx } = renderBuses();
  const sum = stereo(LEN);
  for (const bus of [drums, bass, pad, sfx]) mixStereo(sum, bus, 0, dbToGain(DB.master));
  const L = biquad(sum.L, "highpass", 25), R = biquad(sum.R, "highpass", 25);
  const n = L.length;
  // Sub-bass mono: keep the side channel only above ~120 Hz (reverb tails of low sounds are not centred).
  const side = new Float32Array(n);
  for (let i = 0; i < n; i++) side[i] = 0.5 * (L[i] - R[i]);
  const sideHp = biquad(biquad(side, "highpass", 120), "highpass", 120);
  for (let i = 0; i < n; i++) {
    const m = 0.5 * (L[i] + R[i]);
    L[i] = softClip(m + sideHp[i], 1.2);
    R[i] = softClip(m - sideHp[i], 1.2);
  }
  // Nothing above ~17 kHz: click and noise tops read as a wall up there and overshoot between samples.
  const lp = (x: Float32Array): Float32Array => biquad(biquad(x, "lowpass", 17000), "lowpass", 17000);
  const out = { L: lp(L), R: lp(R) };
  const fadeFrom = n - secToSamples(END_FADE);
  for (let i = fadeFrom; i < n; i++) {
    const g = 0.5 + 0.5 * Math.cos((Math.PI * (i - fadeFrom)) / (n - 1 - fadeFrom));
    out.L[i] *= g;
    out.R[i] *= g;
  }
  limit(out, -1);
  return out;
}

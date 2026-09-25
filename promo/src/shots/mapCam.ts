import { bezier, easeInOutQuint, linear, track, type Ease, type Key } from "../lib/ease.ts";
import { beat } from "../timeline.ts";
import { CAM_S2_START, CAM_S4_START, type Cam, type CamKey } from "../world/camera.ts";
import { MATES, ME } from "../world/data.ts";

/** Cubic Hermite ease from 0 to 1 with slope `m0` at the start and `m1` at the end (monotone for slopes in 0..3). */
function hermite(m0: number, m1: number): Ease {
  return (t) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    const t2 = t * t, t3 = t2 * t;
    return (t3 - 2 * t2 + t) * m0 + (3 * t2 - 2 * t3) + (t3 - t2) * m1;
  };
}

/** Exponential decay from full speed at t = 0 (rate k), normalised to reach 1 at t = 1. */
function expoOut(k: number): Ease {
  const norm = 1 - Math.exp(-k);
  return (t) => (t <= 0 ? 0 : t >= 1 ? 1 : (1 - Math.exp(-k * t)) / norm);
}

/** Critically damped approach (a camera operator's move: no overshoot, gentle start), rate k, reaching 1 at t = 1. */
function critDamp(k: number): Ease {
  const raw = (t: number) => 1 - (1 + k * t) * Math.exp(-k * t);
  const norm = raw(1);
  return (t) => (t <= 0 ? 0 : t >= 1 ? 1 : raw(t) / norm);
}

/**
 * The whip (f224-256): an in-out ease whose top speed (3.4x average) falls on f238, under the loudest part of the
 * f222 whoosh (easeInOutQuint peaks at f240 and barely moves before f234), landing with a little speed left so it
 * flows into the drift.
 */
const WHIP = bezier(0.66, 0, 0.22, 0.93);
/** The drift after the whip: starts at the whip's landing speed, coasts to a stop for the flatten. */
const COAST = hermite(2, 0);

/**
 * Per-channel keys (each channel eases on its own, so a fast zoom and a slow tilt never share a curve).
 * Zoom is keyed as ln(zoom): equal steps read as equal dolly speed.
 */
const CH: Record<keyof Cam, Key[]> = {
  x: [
    [120, ME.x, hermite(0, 0)],
    [200, ME.x + 70, linear],
    [224, ME.x + 70, WHIP],
    [256, ME.x + 30, COAST],
    [330, ME.x + 32, easeInOutQuint],
    [359, CAM_S4_START.x],
  ],
  y: [
    [120, ME.y, hermite(0, 0)],
    [200, ME.y + 110, linear],
    [224, ME.y + 110, WHIP],
    [256, ME.y - 76, COAST],
    [330, ME.y - 74, easeInOutQuint],
    [359, CAM_S4_START.y],
  ],
  zoom: [
    // blast-back: the dolly's top speed is the hit (time constant ~10 frames), then the ring's own growth sweeps it out;
    // from f165 a slow push keeps the camera breathing until the whip
    [120, Math.log(CAM_S2_START.zoom), expoOut(4.6)],
    [165, Math.log(0.525), hermite(0, 0)],
    [224, Math.log(0.56), WHIP],
    [256, Math.log(1.8), COAST],
    [330, Math.log(1.95), easeInOutQuint],
    [359, Math.log(CAM_S4_START.zoom)],
  ],
  tilt: [
    [120, 0, critDamp(12.5)],
    [224, 55, WHIP],
    [256, 50, COAST],
    [330, 50, easeInOutQuint],
    [359, 0],
  ],
  turn: [
    [120, 0, hermite(1.5, 0)],
    [224, -28, WHIP],
    [256, 22, COAST],
    [330, 26, easeInOutQuint],
    [359, 0],
  ],
};

const camOf = (f: number): Cam => ({
  x: track(f, CH.x),
  y: track(f, CH.y),
  zoom: Math.exp(track(f, CH.zoom)),
  tilt: track(f, CH.tilt),
  turn: track(f, CH.turn),
});

/**
 * The shared camera of shots 2 and 3 (f120-359, full frame), one key per frame sampled from the channel
 * curves above; `camAt` interpolates linearly between them (sub-frame times for motion blur included).
 * f120 is exactly CAM_S2_START and f359 exactly CAM_S4_START.
 */
export const MAP_CAM: CamKey[] = Array.from({ length: 359 - 120 + 1 }, (_, i) => {
  const f = 120 + i;
  const cam = f === 120 ? CAM_S2_START : f === 359 ? CAM_S4_START : camOf(f);
  return [f, cam, linear] as const;
});

/** Camera jolt of a teammate landing: a damped wobble (period 6 frames) for 15 frames after each landing; 0 elsewhere. */
export function landingBump(frame: number): number {
  let b = 0;
  for (const m of MATES) {
    const t = frame - m.landAt;
    if (t > 0 && t < 15) b += Math.sin((Math.PI * t) / 3) * Math.exp(-t / 4);
  }
  return b;
}

/** Room code: box k locks on the 16ths from beat 8 (f240, 248, 255, 263, 270, 278). */
export const ROOM_CODE = "K7Q2XM";
export const ROOM_LOCKS: readonly number[] = Array.from(ROOM_CODE, (_, k) => beat(8 + k * 0.25));

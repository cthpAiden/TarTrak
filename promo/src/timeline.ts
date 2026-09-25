/**
 * The one timeline. Frames are global (0..899). The video and the synth (audio/score.ts) both import
 * this file, so every sound lands on the frame its picture does. No imports here: Node runs it as-is.
 */
export const FPS = 60;
export const BPM = 120;
export const WIDTH = 1920;
export const HEIGHT = 1080;
export const DURATION_FRAMES = 900;
export const FRAMES_PER_BEAT = (FPS * 60) / BPM;

/** Frame of beat n (fractions allowed: 0.5 = an 8th, 0.25 = a 16th). */
export const beat = (n: number): number => Math.round(n * FRAMES_PER_BEAT);
/** Frame of bar n (4 beats). */
export const bar = (n: number): number => beat(n * 4);
export const frameToSec = (f: number): number => f / FPS;

export type ShotId = "snap" | "map" | "squad" | "app" | "montage" | "overlay" | "end";
export type Shot = { from: number; to: number; index: number; name: string };
/** `to` is exclusive. */
export const SHOTS: Record<ShotId, Shot> = {
  snap: { from: 0, to: 120, index: 1, name: "SNAP" },
  map: { from: 120, to: 240, index: 2, name: "ON THE MAP" },
  squad: { from: 240, to: 360, index: 3, name: "SQUAD" },
  app: { from: 360, to: 480, index: 4, name: "THE APP" },
  montage: { from: 480, to: 600, index: 5, name: "MONTAGE" },
  overlay: { from: 600, to: 720, index: 6, name: "OVERLAY" },
  end: { from: 720, to: 900, index: 7, name: "END" },
};
export const SHOT_IDS = Object.keys(SHOTS) as ShotId[];
export function shotAt(frame: number): ShotId {
  for (const id of SHOT_IDS) if (frame >= SHOTS[id].from && frame < SHOTS[id].to) return id;
  return frame < 0 ? "snap" : "end";
}

/** Hard cuts that get a short RGB-split glitch. */
export const GLITCHES = [480, 510, 540, 570, 600, 720] as const;
const GLITCH_SHAPE: Record<number, number> = { [-1]: 0.35, 0: 1, 1: 0.7, 2: 0.4, 3: 0.15 };
export function glitchAt(frame: number): number {
  for (const g of GLITCHES) {
    const v = GLITCH_SHAPE[Math.round(frame) - g];
    if (v !== undefined) return v;
  }
  return 0;
}

/** "SS:FF" style running clock for the HUD: minutes:seconds:frames. */
export function timecode(frame: number): string {
  const f = Math.max(0, Math.floor(frame));
  const s = Math.floor(f / FPS);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(Math.floor(s / 60))}:${p(s % 60)}:${p(f % FPS)}`;
}

/** Screen states two shots must agree on at their shared cut. */
export const HANDOFF = {
  /** Last frame of shot 5 = first frame of shot 6: the map seen through a centred circle. */
  iris: { cx: 960, cy: 540, r: 330 },
  /** Last frame of shot 6 = first frame of shot 7: the bezel's outer ring, heading box at 12 o'clock. */
  logo: { cx: 960, cy: 540, r: 270 },
} as const;

export type CueKind =
  | "uiClick" | "pop" | "keyClick" | "shutter" | "chirps" | "pluck" | "riser" | "whoosh"
  | "impact" | "impactLite" | "finalHit" | "crash" | "ping" | "tick" | "thud" | "stab"
  | "dashTicks" | "checkTick" | "scribble" | "glitch" | "ratchet" | "snareRoll" | "shimmer" | "typing";
/** A sound tied to a picture event. `dur` in frames; `note` like "A4"; `pan` -1..1 (whoosh: sweeps -pan to +pan); `gain` linear. */
export type Cue = { at: number; kind: CueKind; dur?: number; note?: string; pan?: number; gain?: number };

const cues: Cue[] = [
  // 1 SNAP
  { at: 6, kind: "uiClick", gain: 0.5 },
  { at: 22, kind: "pop", note: "A4", gain: 0.6 },
  { at: 60, kind: "keyClick" },
  { at: 64, kind: "shutter" },
  { at: 70, kind: "chirps", dur: 30 },
  { at: 75, kind: "riser", dur: 45 },
  { at: 80, kind: "pluck", note: "A4" },
  { at: 88, kind: "pluck", note: "C5" },
  { at: 96, kind: "pluck", note: "E5" },
  { at: 104, kind: "whoosh", dur: 16, pan: 0 },
  // 2 ON THE MAP
  { at: 120, kind: "impact" },
  { at: 120, kind: "ping" },
  { at: 120, kind: "crash", gain: 0.5 },
  { at: 150, kind: "pop", note: "E5" },
  { at: 165, kind: "pop", note: "G5" },
  { at: 180, kind: "pop", note: "A5" },
  { at: 195, kind: "pop", note: "C6" },
  { at: 210, kind: "pop", note: "E6" },
  { at: 222, kind: "whoosh", dur: 30, pan: 0.8 },
  // 3 SQUAD
  { at: 240, kind: "impactLite" },
  { at: 240, kind: "tick", note: "E6" },
  { at: 248, kind: "tick", note: "E6" },
  { at: 252, kind: "whoosh", dur: 18, pan: -0.3 },
  { at: 255, kind: "tick", note: "E6" },
  { at: 263, kind: "tick", note: "E6" },
  { at: 267, kind: "whoosh", dur: 18, pan: 0.3 },
  { at: 270, kind: "tick", note: "A6" },
  { at: 270, kind: "pluck", note: "A4" },
  { at: 270, kind: "thud" },
  { at: 278, kind: "tick", note: "A6" },
  { at: 282, kind: "whoosh", dur: 18, pan: 0 },
  { at: 285, kind: "pluck", note: "C5" },
  { at: 285, kind: "thud" },
  { at: 300, kind: "pluck", note: "E5" },
  { at: 300, kind: "thud" },
  { at: 330, kind: "whoosh", dur: 30, pan: -0.5 },
  // 4 THE APP
  { at: 360, kind: "impactLite" },
  { at: 362, kind: "uiClick" },
  { at: 367, kind: "uiClick" },
  { at: 372, kind: "uiClick" },
  { at: 377, kind: "uiClick" },
  { at: 380, kind: "whoosh", dur: 40, pan: 0.3 },
  { at: 382, kind: "tick", note: "A5" },
  { at: 386, kind: "tick", note: "C6" },
  { at: 390, kind: "tick", note: "E6" },
  { at: 390, kind: "pluck", note: "G4" },
  { at: 405, kind: "pluck", note: "A4" },
  { at: 420, kind: "pluck", note: "C5" },
  { at: 435, kind: "pluck", note: "E5" },
  { at: 450, kind: "riser", dur: 30 },
  { at: 466, kind: "whoosh", dur: 14, pan: 0 },
  // 5 MONTAGE
  { at: 480, kind: "stab" },
  { at: 480, kind: "impactLite", gain: 0.7 },
  { at: 481, kind: "dashTicks", dur: 20 },
  { at: 510, kind: "stab" },
  { at: 510, kind: "impactLite", gain: 0.7 },
  { at: 514, kind: "checkTick" },
  { at: 520, kind: "checkTick" },
  { at: 526, kind: "checkTick" },
  { at: 540, kind: "stab" },
  { at: 540, kind: "impactLite", gain: 0.7 },
  { at: 540, kind: "keyClick" },
  { at: 540, kind: "riser", dur: 60 },
  { at: 546, kind: "keyClick" },
  { at: 552, kind: "thud" },
  { at: 570, kind: "stab" },
  { at: 570, kind: "impactLite", gain: 0.7 },
  { at: 571, kind: "scribble", dur: 24 },
  { at: 596, kind: "glitch" },
  // 6 OVERLAY
  { at: 600, kind: "impact" },
  { at: 600, kind: "crash" },
  { at: 600, kind: "ratchet", dur: 24 },
  { at: 624, kind: "tick", note: "A5" },
  { at: 627, kind: "tick", note: "C6" },
  { at: 630, kind: "tick", note: "E6" },
  { at: 630, kind: "whoosh", dur: 36, pan: -0.4 },
  { at: 633, kind: "tick", note: "A6" },
  { at: 645, kind: "pop", note: "A5" },
  { at: 648, kind: "pop", note: "E5" },
  { at: 652, kind: "pop", note: "G5" },
  { at: 656, kind: "pop", note: "A5" },
  { at: 658, kind: "tick", note: "C6" },
  { at: 662, kind: "tick", note: "C6" },
  { at: 664, kind: "uiClick" },
  { at: 666, kind: "tick", note: "C6" },
  { at: 670, kind: "tick", note: "C6" },
  { at: 675, kind: "riser", dur: 45 },
  { at: 684, kind: "whoosh", dur: 24, pan: 0.5 },
  { at: 690, kind: "snareRoll", dur: 30 },
  // 7 END
  { at: 720, kind: "finalHit" },
  { at: 724, kind: "shimmer", dur: 36 },
  { at: 780, kind: "pluck", note: "C5" },
  { at: 795, kind: "pluck", note: "E5" },
  { at: 810, kind: "pluck", note: "A5" },
  { at: 810, kind: "typing", dur: 30 },
  { at: 840, kind: "ping", gain: 0.8 },
];
export const CUES: readonly Cue[] = cues.sort((a, b) => a.at - b.at);

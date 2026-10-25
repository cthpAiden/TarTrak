/**
 * The reel's timeline (50 s since "how it works" grew to 11 s): the showreel's shots 1-4 as they are
 * (0-479), six new scenes (480-2579), then shots 5-7 shifted 2100 frames later (2580-2999). The video and
 * the synth (audio/reel45.ts) both import this file. No imports beyond ../timeline.ts: Node runs it as-is.
 */
import { CUES, type Cue } from "../timeline.ts";

export const DURATION_FRAMES = 3000;
/** Shots 5-7 play this many frames later than in the 15 s cut. */
export const SHIFT = 2100;

export type SceneId =
  | "snap" | "map" | "squad" | "app"
  | "safe" | "maps" | "exits" | "clock" | "share" | "keys"
  | "montage" | "overlay" | "end";
export type Scene = { from: number; to: number; index: number; name: string };
/** `to` is exclusive. */
export const SCENES: Record<SceneId, Scene> = {
  snap: { from: 0, to: 120, index: 1, name: "SNAP" },
  map: { from: 120, to: 240, index: 2, name: "ON THE MAP" },
  squad: { from: 240, to: 360, index: 3, name: "SQUAD" },
  app: { from: 360, to: 480, index: 4, name: "THE APP" },
  safe: { from: 480, to: 1140, index: 5, name: "HOW IT WORKS" },
  maps: { from: 1140, to: 1380, index: 6, name: "MAPS" },
  exits: { from: 1380, to: 1680, index: 7, name: "EXTRACTS" },
  clock: { from: 1680, to: 1920, index: 8, name: "RAID CLOCK" },
  share: { from: 1920, to: 2280, index: 9, name: "SHARED MARKERS" },
  keys: { from: 2280, to: 2580, index: 10, name: "HOTKEYS" },
  montage: { from: 2580, to: 2700, index: 11, name: "MONTAGE" },
  overlay: { from: 2700, to: 2820, index: 12, name: "OVERLAY" },
  end: { from: 2820, to: 3000, index: 13, name: "END" },
};
export const SCENE_IDS = Object.keys(SCENES) as SceneId[];
export function sceneAt(frame: number): SceneId {
  for (const id of SCENE_IDS) if (frame >= SCENES[id].from && frame < SCENES[id].to) return id;
  return frame < 0 ? "snap" : "end";
}

/** Hard cuts that get the RGB-split glitch: the showreel's (shifted) plus the new scenes' hard cuts. */
export const GLITCHES = [480, 1140, 1380, 1920, 2580, 2610, 2640, 2670, 2700, 2820] as const;
const GLITCH_SHAPE: Record<number, number> = { [-1]: 0.35, 0: 1, 1: 0.7, 2: 0.4, 3: 0.15 };
export function glitchAt(frame: number): number {
  for (const g of GLITCHES) {
    const v = GLITCH_SHAPE[Math.round(frame) - g];
    if (v !== undefined) return v;
  }
  return 0;
}

/**
 * Local frames inside each new scene where things happen. The scenes draw from these and the cues below
 * sound on them, so picture and sound cannot drift apart.
 */
export const SAFE = {
  /** The game view; PRT SC rises at `key`, goes down on beat 2 and comes back up at `release`. */
  key: 6,
  press: 30,
  release: 44,
  /** The shutter fires; under its flash the frozen frame shrinks into a file card while its filename decodes. */
  shutter: 34,
  shrink: [36, 58],
  decode: [44, 70],
  /**
   * The read head runs the filename from `scan` and rests a beat on each of X, Y, Z and the rotation: it
   * reaches each field's end on its `fields` frame, `move` frames after leaving the last, and runs off the
   * end at `scanEnd`. The brackets then hold for half a bar.
   */
  scan: 90,
  fields: [120, 150, 180, 210],
  move: 14,
  scanEnd: 222,
  /** The rest of the filename falls away; the four fields drop into their cells, landing on beat 10. */
  fall: 252,
  drop: [254, 270],
  /** Each cell translates its field a beat apart; the compass needle spins `spin` frames down onto the heading on beat 14. */
  resolve: [300, 330, 360, 390],
  spin: 36,
  /** All four translations hold for two beats; X and Z swing round into a grid's axes and throw lines that meet; the lock lands on beat 18. */
  axes: [450, 478],
  project: [480, 504],
  lock: 510,
  /** The map comes up under the lock and its name pops. */
  map: [510, 540],
  tag: 526,
  headline: [544, 552],
  caption: 564,
  out: 638,
} as const;
export const MAPS = { spinFrom: 4, land: 150, headline: [8, 16], out: 224 } as const;
export const EXITS = { pops: [18, 30, 42, 54, 66], route: [104, 146], headline: [120, 128], out: 284 } as const;
export const CLOCK = { lapse: [6, 150], red: 150, beats: [150, 180, 210], headline: [12, 20], out: 222 } as const;
export const SHARE = {
  panels: [0, 6, 12],
  cursor: 30,
  menu: 56,
  typeFrom: 64,
  typeTo: 84,
  hover: 92,
  click: 104,
  arrive: [104, 114, 122],
  headline: [140, 148],
  /** The pencil turns on, then my stroke draws round the pin; each teammate's copy runs `lag` frames behind. */
  pencil: 166,
  draw: [178, 254],
  lag: 6,
  out: 336,
} as const;
export const KEYS = {
  appear: [6, 10, 14],
  /** [key, press, release]: F5 shows the overlay, F6 halves its opacity, F7 hides it and brings it back. */
  presses: [
    [0, 30, 48],
    [1, 72, 88],
    [1, 98, 114],
    [2, 128, 144],
    [2, 156, 172],
  ],
  /** Settings > Overlay shape: the circle turns into the box, then back. */
  shape: [192, 232],
  headline: [44, 52],
  flyOff: 262,
  out: 262,
} as const;

const at = (scene: SceneId, local: number) => SCENES[scene].from + local;
const cue = (scene: SceneId, local: number, c: Omit<Cue, "at">): Cue => ({ at: at(scene, local), ...c });

const NOTES = ["A5", "C6", "E6", "G6", "A6"] as const;

const newCues: Cue[] = [
  // 5 HOW IT WORKS: no drums; the key, the shutter, the read head and the decoder are the rhythm.
  cue("safe", SAFE.key, { kind: "pop", note: "A4", gain: 0.6 }),
  cue("safe", SAFE.press, { kind: "keyClick" }),
  cue("safe", SAFE.press, { kind: "thud" }),
  cue("safe", SAFE.shutter, { kind: "shutter" }),
  cue("safe", SAFE.shrink[0], { kind: "whoosh", dur: 20, pan: 0 }),
  cue("safe", SAFE.decode[0], { kind: "chirps", dur: SAFE.decode[1] - SAFE.decode[0] }),
  cue("safe", SAFE.scan, { kind: "dashTicks", dur: SAFE.fields[0] - SAFE.scan }),
  ...SAFE.fields.slice(1).map((f) => cue("safe", f - SAFE.move, { kind: "dashTicks", dur: SAFE.move })),
  cue("safe", SAFE.fields[3] + 2, { kind: "dashTicks", dur: SAFE.scanEnd - SAFE.fields[3] - 2 }),
  ...SAFE.fields.map((f, k) => cue("safe", f, { kind: "pluck", note: ["A4", "C5", "E5", "A5"][k] })),
  cue("safe", SAFE.fall, { kind: "whoosh", dur: 18, pan: -0.3 }),
  cue("safe", SAFE.drop[1], { kind: "thud" }),
  cue("safe", SAFE.drop[1], { kind: "stab", gain: 0.55 }),
  ...SAFE.resolve.map((r, k) => cue("safe", r, { kind: "tick", note: ["E6", "D6", "C6", "A5"][k] })),
  cue("safe", SAFE.resolve[3] - SAFE.spin, { kind: "ratchet", dur: SAFE.spin - 6 }),
  cue("safe", SAFE.resolve[3], { kind: "stab", gain: 0.55 }),
  cue("safe", SAFE.axes[0], { kind: "whoosh", dur: 22, pan: 0.4 }),
  cue("safe", SAFE.project[0], { kind: "dashTicks", dur: SAFE.project[1] - SAFE.project[0] }),
  cue("safe", SAFE.lock, { kind: "impactLite" }),
  cue("safe", SAFE.lock, { kind: "ping" }),
  cue("safe", SAFE.lock + 4, { kind: "checkTick" }),
  cue("safe", SAFE.tag, { kind: "pop", note: "E6" }),
  cue("safe", SAFE.headline[0], { kind: "impactLite" }),
  cue("safe", SAFE.caption, { kind: "typing", dur: 30 }),
  cue("safe", 540, { kind: "riser", dur: 120 }),
  cue("safe", 600, { kind: "snareRoll", dur: 60 }),
  cue("safe", SAFE.out - 6, { kind: "whoosh", dur: 22, pan: 0.6 }),
  // 6 MAPS: the drop; the reel ratchets, slows and lands.
  cue("maps", 0, { kind: "impact" }),
  cue("maps", 0, { kind: "crash", gain: 0.6 }),
  cue("maps", MAPS.spinFrom, { kind: "ratchet", dur: MAPS.land - MAPS.spinFrom - 30 }),
  ...[120, 132, 142].map((f, k) => cue("maps", f, { kind: "tick", note: NOTES[k] })),
  cue("maps", MAPS.land, { kind: "impactLite" }),
  cue("maps", MAPS.land, { kind: "ping" }),
  cue("maps", MAPS.out - 8, { kind: "whoosh", dur: 24, pan: -0.6 }),
  // 7 EXTRACTS
  ...EXITS.pops.map((p, k) => cue("exits", p, { kind: "pop", note: NOTES[k] })),
  cue("exits", EXITS.route[0], { kind: "whoosh", dur: 30, pan: 0.4 }),
  cue("exits", EXITS.route[0] + 2, { kind: "dashTicks", dur: EXITS.route[1] - EXITS.route[0] - 4 }),
  cue("exits", EXITS.route[1], { kind: "ping" }),
  cue("exits", EXITS.route[1], { kind: "pluck", note: "A4" }),
  cue("exits", EXITS.out - 8, { kind: "whoosh", dur: 24, pan: 0.6 }),
  // 8 RAID CLOCK
  cue("clock", 0, { kind: "impactLite" }),
  cue("clock", CLOCK.lapse[0], { kind: "ratchet", dur: CLOCK.lapse[1] - CLOCK.lapse[0] - 20 }),
  cue("clock", CLOCK.red, { kind: "stab" }),
  ...CLOCK.beats.map((b) => cue("clock", b, { kind: "tick", note: "A6" })),
  cue("clock", CLOCK.out - 8, { kind: "whoosh", dur: 24, pan: -0.5 }),
  // 9 SHARED MARKERS
  ...SHARE.panels.map((p, k) => cue("share", p, { kind: k === 0 ? "impactLite" : "whoosh", dur: 16, pan: [-0.6, 0, 0.6][k] })),
  cue("share", SHARE.menu, { kind: "uiClick" }),
  cue("share", SHARE.typeFrom, { kind: "typing", dur: SHARE.typeTo - SHARE.typeFrom }),
  cue("share", SHARE.click, { kind: "uiClick" }),
  ...SHARE.arrive.map((a, k) => cue("share", a, { kind: "pop", note: ["E5", "A5", "C6"][k], pan: [-0.6, 0, 0.6][k] })),
  cue("share", SHARE.arrive[0], { kind: "ping" }),
  cue("share", SHARE.pencil, { kind: "uiClick" }),
  cue("share", SHARE.draw[0], { kind: "scribble", dur: SHARE.draw[1] - SHARE.draw[0] }),
  cue("share", SHARE.draw[1] + 2 * SHARE.lag, { kind: "pop", note: "E6", pan: 0.6 }),
  cue("share", SHARE.out - 8, { kind: "whoosh", dur: 24, pan: 0.4 }),
  // 10 HOTKEYS
  ...KEYS.presses.flatMap(([k, press]) => [
    cue("keys", press, { kind: "keyClick" }),
    cue("keys", press, { kind: "tick", note: ["A5", "C6", "E6"][k] }),
  ]),
  cue("keys", KEYS.presses[0][1], { kind: "shimmer", dur: 30 }),
  cue("keys", KEYS.presses[3][1], { kind: "whoosh", dur: 14, pan: 0.6 }),
  cue("keys", KEYS.presses[4][1], { kind: "pop", note: "A5" }),
  ...KEYS.shape.map((f, k) => cue("keys", f, { kind: "pop", note: ["E6", "A5"][k] })),
  ...KEYS.shape.map((f) => cue("keys", f - 2, { kind: "uiClick" })),
  cue("keys", 180, { kind: "riser", dur: 120 }),
  cue("keys", 240, { kind: "snareRoll", dur: 60 }),
  cue("keys", KEYS.flyOff, { kind: "whoosh", dur: 30, pan: 0 }),
  cue("keys", 296, { kind: "glitch" }),
];

/** The showreel's cues, shots 5-7 shifted, with the new scenes' cues merged in. */
export const CUES_45: readonly Cue[] = [
  ...CUES.map((c) => (c.at >= 480 ? { ...c, at: c.at + SHIFT } : c)),
  ...newCues,
].sort((a, b) => a.at - b.at);

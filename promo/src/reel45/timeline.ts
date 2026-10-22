/**
 * The 45 s reel's timeline: the showreel's shots 1-4 as they are (0-479), six new scenes (480-2279),
 * then shots 5-7 shifted 1800 frames later (2280-2699). The video and the synth (audio/reel45.ts) both
 * import this file. No imports beyond ../timeline.ts: Node runs it as-is.
 */
import { CUES, type Cue } from "../timeline.ts";

export const DURATION_FRAMES = 2700;
/** Shots 5-7 play this many frames later than in the 15 s cut. */
export const SHIFT = 1800;

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
  safe: { from: 480, to: 840, index: 5, name: "HOW IT WORKS" },
  maps: { from: 840, to: 1080, index: 6, name: "MAPS" },
  exits: { from: 1080, to: 1380, index: 7, name: "EXTRACTS" },
  clock: { from: 1380, to: 1620, index: 8, name: "RAID CLOCK" },
  share: { from: 1620, to: 1980, index: 9, name: "SHARED MARKERS" },
  keys: { from: 1980, to: 2280, index: 10, name: "HOTKEYS" },
  montage: { from: 2280, to: 2400, index: 11, name: "MONTAGE" },
  overlay: { from: 2400, to: 2520, index: 12, name: "OVERLAY" },
  end: { from: 2520, to: 2700, index: 13, name: "END" },
};
export const SCENE_IDS = Object.keys(SCENES) as SceneId[];
export function sceneAt(frame: number): SceneId {
  for (const id of SCENE_IDS) if (frame >= SCENES[id].from && frame < SCENES[id].to) return id;
  return frame < 0 ? "snap" : "end";
}

/** Hard cuts that get the RGB-split glitch: the showreel's (shifted) plus the new scenes' hard cuts. */
export const GLITCHES = [480, 840, 1080, 1620, 2280, 2310, 2340, 2370, 2400, 2520] as const;
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
  /** Step rows: each slams in at `rows[k]` and is underlined 12 frames later. */
  rows: [6, 36, 66, 96, 126],
  markAfter: 12,
  collapse: 168,
  headline: [186, 194],
  check: 204,
  caption: 222,
  out: 338,
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
  // 5 HOW IT WORKS: no drums; every row is a hit, every underline a scrape.
  ...SAFE.rows.flatMap((r, k) => [
    cue("safe", r, { kind: "thud" }),
    cue("safe", r, { kind: "keyClick" }),
    cue("safe", r + SAFE.markAfter, { kind: "stab", gain: 0.55 }),
    cue("safe", r + SAFE.markAfter, { kind: "tick", note: ["E6", "D6", "C6", "B5", "A5"][k] }),
  ]),
  cue("safe", SAFE.collapse - 4, { kind: "whoosh", dur: 20, pan: 0 }),
  cue("safe", SAFE.headline[0], { kind: "impactLite" }),
  cue("safe", SAFE.check, { kind: "checkTick" }),
  cue("safe", SAFE.check + 6, { kind: "pluck", note: "E5" }),
  cue("safe", SAFE.caption, { kind: "typing", dur: 30 }),
  cue("safe", 240, { kind: "riser", dur: 120 }),
  cue("safe", 300, { kind: "snareRoll", dur: 60 }),
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

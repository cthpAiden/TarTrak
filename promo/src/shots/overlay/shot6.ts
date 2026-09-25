/**
 * Shot 6's pure maths: the stage path (the camera round the round minimap), the bezel's build
 * timings, where things sit on the ring as it turns heading-up, the rim slots and the backdrop's
 * handheld sway. Angles are degrees clockwise from 12 o'clock with y down, as in the app's circle.ts.
 */
import { clamp, easeInCubic, easeInExpo, easeInOutCubic, easeInOutQuint, easeOutExpo, lerp, prog } from "../../lib/ease.ts";
import { rng } from "../../lib/random.ts";
import { HANDOFF } from "../../timeline.ts";

/** The minimap at its natural place on the 1920x1080 stage: centre, disc radius, the app's RING, outer radius. */
export const MINI = { x: 1640, y: 300, r: 165, ring: 26, ro: 191 } as const;

type Pt = { x: number; y: number };

/** A point at `radius` from (cx, cy), `deg` clockwise from 12 o'clock (screen y grows down). */
export function polar(cx: number, cy: number, radius: number, deg: number): Pt {
  const a = (deg * Math.PI) / 180;
  return { x: cx + radius * Math.sin(a), y: cy - radius * Math.cos(a) };
}

/** Smallest absolute difference between two angles, in degrees (0..180). */
export function angleGap(a: number, b: number): number {
  const d = (((a - b) % 360) + 360) % 360;
  return d > 180 ? 360 - d : d;
}

/** "048" style readout of an angle. */
export const pad3 = (deg: number): string => String(((Math.round(deg) % 360) + 360) % 360).padStart(3, "0");

// Stage ------------------------------------------------------------------------------------------

/** The stage's scale and where the minimap's centre sits on screen. */
export type Stage = { s: number; x: number; y: number };
export const PULL = { from: 630, to: 666 } as const;
export const PUSH = { from: 696, to: 719 } as const;
/** Stage scale at the iris (disc = HANDOFF.iris) and at the cut to the logo (outer bezel = HANDOFF.logo). */
export const S_IRIS = HANDOFF.iris.r / MINI.r;
export const S_LOGO = HANDOFF.logo.r / MINI.ro;

/**
 * A zoom about one fixed screen point, from scale s0 with the minimap centred at c0 to s1 at c1: the
 * scale moves evenly in log space and the centre follows the scale, so nothing slides against the zoom.
 */
function zoom(e: number, s0: number, c0: Pt, s1: number, c1: Pt): Stage {
  const s = s0 * Math.pow(s1 / s0, e);
  const k = (s - s0) / (s1 - s0);
  return { s, x: lerp(c0.x, c1.x, k), y: lerp(c0.y, c1.y, k) };
}

/** 600-630 held on the iris, 630-666 pull back to the corner (easeInOutQuint), 696-719 push into the bezel (easeInExpo). */
export function stageAt(frame: number): Stage {
  const home = { x: MINI.x, y: MINI.y };
  if (frame < PUSH.from) return zoom(prog(frame, PULL.from, PULL.to, easeInOutQuint), S_IRIS, { x: HANDOFF.iris.cx, y: HANDOFF.iris.cy }, 1, home);
  return zoom(prog(frame, PUSH.from, PUSH.to, easeInExpo), 1, home, S_LOGO, { x: HANDOFF.logo.cx, y: HANDOFF.logo.cy });
}

/** Where a stage point lands on screen. */
export const toScreen = (st: Stage, p: Pt): Pt => ({ x: st.x + st.s * (p.x - MINI.x), y: st.y + st.s * (p.y - MINI.y) });

/** CSS transform (origin 0 0) that puts the 1920x1080 stage on screen. */
export const stageTransform = (st: Stage): string => `translate(${st.x - st.s * MINI.x}px, ${st.y - st.s * MINI.y}px) scale(${st.s})`;

/** How fast (screen px per frame) the fastest point of the bezel's outer edge moves at `frame`. */
export function ringSpeed(frame: number): number {
  const a = stageAt(frame - 0.25);
  const b = stageAt(frame + 0.25);
  let v = 0;
  for (const deg of [0, 90, 180, 270]) {
    const p = polar(MINI.x, MINI.y, MINI.ro, deg);
    const pa = toScreen(a, p);
    const pb = toScreen(b, p);
    v = Math.max(v, 2 * Math.hypot(pb.x - pa.x, pb.y - pa.y));
  }
  return v;
}

// Bezel build ------------------------------------------------------------------------------------

/** Minor ticks: 72, every 5° clockwise from N, three a frame over 600-624, each flying in from 60 px outside. */
export const MINOR = { n: 72, from: 600, perFrame: 3, fly: 9, dist: 60 } as const;
export const minorStart = (k: number): number => MINOR.from + k / MINOR.perFrame;

/** How far out (px) minor tick k still is, its opacity, and how far it moved over the last frame (for a speed streak). */
export function minorAt(frame: number, k: number): { off: number; o: number; streak: number } {
  const t0 = minorStart(k);
  if (frame <= t0) return { off: MINOR.dist, o: 0, streak: 0 };
  const e = (f: number) => easeOutExpo(clamp((f - t0) / MINOR.fly));
  return { off: MINOR.dist * (1 - e(frame)), o: clamp((4 * (frame - t0)) / MINOR.fly), streak: MINOR.dist * (e(frame) - e(frame - 1)) };
}

/** The quadrant snaps: each cardinal's major tick and letter land together with the two numbers after it. */
export const SNAPS = [624, 627, 630, 633] as const;
export const snapFrame = (deg: number): number => SNAPS[Math.floor((((deg % 360) + 360) % 360) / 90)];
/** 0..1 as a snapping element drops in over the 4 frames before it lands; easeInCubic, so the landing is the hit. */
export const snapIn = (frame: number, at: number): number => prog(frame, at - 4, at, easeInCubic);
/** A flash that peaks on a hit and dies away over `dur` frames. */
export const flash = (frame: number, at: number, dur = 8): number => (frame < at ? 0 : (1 - prog(frame, at, at + dur)) ** 2);

/** Ring labels as in the app's CircleBezel: letters on the cardinals, numbers between. */
export const LABELS: ReadonlyArray<{ deg: number; text: string; letter: boolean }> = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(
  (deg) => {
    const letter = { 0: "N", 90: "E", 180: "S", 270: "W" }[deg];
    return { deg, text: letter ?? String(deg), letter: letter !== undefined };
  },
);

/** My heading, and the heading box's build: it pops in on N and slides round to 048°, landing on the pop cue (645). */
export const HDG = 48;
export const BOX = { appear: 636, land: 645 } as const;
/** Starts at rest and still carries 1.2x its average speed when it lands, so the landing reads as a hit. */
const approach = (t: number) => -0.8 * t ** 3 + 1.8 * t ** 2;
const LAND_SPEED = (HDG * 1.2) / (BOX.land - BOX.appear - 1);
/** The detent after the landing: a damped swing past 048° and back in 3 frames, starting at the landing speed. */
const DETENT = { w: Math.PI / 3, k: 0.65, frames: 3 } as const;

/** The box's place on the north-up ring (before the heading-up turn). */
export function boxSlide(frame: number): number {
  if (frame <= BOX.appear + 1) return 0;
  if (frame < BOX.land) return HDG * approach(prog(frame, BOX.appear + 1, BOX.land));
  const tau = frame - BOX.land;
  if (tau >= DETENT.frames) return HDG;
  return HDG + (LAND_SPEED / DETENT.w) * Math.exp(-DETENT.k * tau) * Math.sin(DETENT.w * tau);
}

/** Heading-up: over 684-704 the map turns +48° and the ring -48° under the box, which ends at 12 o'clock. */
export const TURN = { from: 684, to: 704 } as const;
export const upAt = (frame: number): number => prog(frame, TURN.from, TURN.to, easeInOutCubic);
/** Turn of the ring (ticks, labels, marks), degrees clockwise: 0 north-up, -48 heading-up. */
export const ringTurn = (frame: number): number => 0 - HDG * upAt(frame);
/** Where the heading box sits on screen: it rides the ring, so on the ring's own scale it reads 048. */
export const boxAngle = (frame: number): number => boxSlide(frame) + ringTurn(frame);
/** A ring label under the heading box fades out; within 13° it is gone, as the app leaves it out. */
export const labelVis = (labelDeg: number, boxDeg: number): number => clamp((angleGap(labelDeg, boxDeg) - 13) / 3);

/** Teammate marks land on the ring on the pops; the route diamond with the last one. */
export const MARK_AT = { ghost: 648, nomad: 652, vex: 656, route: 656 } as const;

// Rim --------------------------------------------------------------------------------------------

/** Chips: the app's start angle and gap beyond the bezel, and the clearance they keep from the ring and each other. */
export const CHIP = { gap: 16, start: 170, clear: 3, at: [658, 662, 666, 670] } as const;

type Box = { x0: number; x1: number; y0: number; y1: number };
const boxOn = (radius: number, deg: number, hw: number, hh: number): Box => {
  const c = polar(0, 0, radius, deg);
  return { x0: c.x - hw, x1: c.x + hw, y0: c.y - hh, y1: c.y + hh };
};
/** Distance from the disc's centre to the nearest point of a box. */
const reach = (b: Box) => Math.hypot(Math.max(b.x0, 0, -b.x1), Math.max(b.y0, 0, -b.y1));
const apart = (a: Box, b: Box, gap: number) => a.x0 >= b.x1 + gap || a.x1 <= b.x0 - gap || a.y1 <= b.y0 - gap || a.y0 >= b.y1 + gap;

/**
 * Where the chips sit (centre angle and radius) for a bezel of outer radius `ro`, given each chip's half
 * width and the half height they share. The first sits at the app's 170°; each next one steps up the
 * lower-right arc as little as it can while clearing the one below. A chip is pushed out from the app's
 * gap just far enough to clear the ring: the app's own chips are narrow, these carry a clock or a dot.
 */
export function chipSlots(ro: number, halves: readonly number[], hh: number): Array<{ deg: number; radius: number }> {
  const place = (deg: number, hw: number) => {
    let radius = ro + CHIP.gap;
    while (reach(boxOn(radius, deg, hw, hh)) < ro + CHIP.clear) radius += 0.25;
    return { deg, radius, box: boxOn(radius, deg, hw, hh) };
  };
  const out: Array<ReturnType<typeof place>> = [];
  for (const hw of halves) {
    const prev = out[out.length - 1];
    if (!prev) {
      out.push(place(CHIP.start, hw));
      continue;
    }
    let p = place(prev.deg - 0.5, hw);
    while (!apart(p.box, prev.box, CHIP.clear) && p.deg > 90) p = place(p.deg - 0.5, hw);
    out.push(p);
  }
  return out.map(({ deg, radius }) => ({ deg, radius }));
}

/** Rim buttons: the app's gap, size and angles (full window, follow, route, draw, rotation), popping 3 frames apart. */
export const RIM = { gap: 18, size: 30, angles: [190, 212, 234, 256, 278], at: [664, 667, 670, 673, 676] } as const;

// Backdrop ---------------------------------------------------------------------------------------

/** Smooth seeded noise in [-1, 1]: three sines with seeded rates and phases (a slow sway, a breath, a tremor). */
function wave(frame: number, seed: number): number {
  const r = rng(seed);
  let v = 0;
  for (const [rate, amp] of [[0.021, 0.55], [0.047, 0.3], [0.113, 0.15]] as const) {
    v += amp * Math.sin(frame * rate * (0.8 + 0.4 * r()) + r() * Math.PI * 2);
  }
  return v;
}

/** Handheld camera sway for the game view: ±6 px, ±0.3°. */
export function sway(frame: number, seed = 606): { x: number; y: number; rot: number } {
  return { x: 6 * wave(frame, seed), y: 6 * wave(frame, seed + 1), rot: 0.3 * wave(frame, seed + 2) };
}

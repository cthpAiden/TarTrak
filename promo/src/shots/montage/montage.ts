/**
 * Shot 5 (MONTAGE, f480-599): cut timing, the giant word's letter fill, the four cameras and the iris.
 * Cameras here are screen cameras (zoom = screen px per unit on the 1920 x 1080 frame).
 */
import { getLength, getPointAtLength } from "@remotion/paths";
import { bezier, clamp, easeInOutQuint, easeOutCubic, lerp, prog, type Ease } from "../../lib/ease.ts";
import { HANDOFF, SHOTS } from "../../timeline.ts";
import { CAM_IRIS, type Cam } from "../../world/camera.ts";
import { EXTRACTS, ME, M_PER_UNIT, PIN, QUEST_ZONES, ROUTE_TARGET, STROKE, fromBearing, type Pt } from "../../world/data.ts";
import { smoothPath } from "../../world/geom.ts";

export const CUT_LEN = 30;
export const CUTS = [
  { word: "ROUTE", at: 480 },
  { word: "QUESTS", at: 510 },
  { word: "MARK", at: 540 },
  { word: "DRAW", at: 570 },
] as const;

/** The cut a frame of shot 5 falls in (clamped to the shot) and the frame within that cut. */
export function cutAt(frame: number): { index: number; local: number } {
  const index = clamp(Math.floor((frame - SHOTS.montage.from) / CUT_LEN), 0, CUTS.length - 1);
  return { index, local: frame - CUTS[index].at };
}

/** The word fills letter by letter over these cut frames, each letter over LETTER frames. */
export const FILL = [1, 25] as const;
const LETTER = 7;
/** Fill (0..1, eased) of letter `i` of `n` at cut frame `local`. */
export function letterFill(i: number, n: number, local: number): number {
  const stagger = n > 1 ? (FILL[1] - FILL[0] - LETTER) / (n - 1) : 0;
  const start = FILL[0] + i * stagger;
  return prog(local, start, start + LETTER, easeOutCubic);
}

/**
 * A top-down camera move as one zoom about the point both views share, the zoom interpolated
 * geometrically: every map point travels in a straight line on screen. Tilt and turn are lerped (the
 * straight-line property needs both cameras flat and unturned).
 */
export function zoomBetween(a: Cam, b: Cam, t: number): Cam {
  if (t <= 0) return a;
  if (t >= 1) return b;
  const zoom = a.zoom * Math.pow(b.zoom / a.zoom, t);
  const tilt = lerp(a.tilt, b.tilt, t);
  const turn = lerp(a.turn, b.turn, t);
  if (Math.abs(a.zoom - b.zoom) < 1e-9) return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), zoom, tilt, turn };
  // F stays put on screen: (F - a) * a.zoom = (F - b) * b.zoom
  const fx = (a.x * a.zoom - b.x * b.zoom) / (a.zoom - b.zoom);
  const fy = (a.y * a.zoom - b.y * b.zoom) / (a.zoom - b.zoom);
  const k = a.zoom / zoom;
  return { x: fx - (fx - a.x) * k, y: fy - (fy - a.y) * k, zoom, tilt, turn };
}

// ---- cut 1: ROUTE --------------------------------------------------------------------------------

export const ROUTE_TO: Pt = EXTRACTS.find((e) => e.id === ROUTE_TARGET)!;
/** A glide that is still moving at the cut. */
const GLIDE: Ease = bezier(0.3, 0.55, 0.45, 0.9);
/** The route sits this many px right of the frame centre, clear of the word. */
const ROUTE_SIDE = 230;

/** Tilted 35° and turned 35° so the route runs up-screen; the focus glides from me towards the gate. */
export function routeCam(frame: number): Cam {
  const t = prog(frame, 480, 509, GLIDE);
  const zoom = lerp(1.3, 1.45, t);
  // from 27% along (me low in frame, SAWMILL's label below it, off the HUD timecode) to 74%
  const along = lerp(0.27, 0.74, t);
  const on = { x: lerp(ME.x, ROUTE_TO.x, along), y: lerp(ME.y, ROUTE_TO.y, along) };
  const focus = fromBearing(on, 35 - 90, (ROUTE_SIDE / zoom) * M_PER_UNIT);
  return { x: focus.x, y: focus.y, zoom, tilt: 35, turn: 35 };
}

// ---- cut 2: QUESTS -------------------------------------------------------------------------------

export const Q1 = QUEST_ZONES[0];
/** The blob's own centre (also the centre of NOMAD's loop). */
export const Q1_CENTRE: Pt = { x: 1650, y: 1320 };
/** Top-down on zone q1, pushing in (a camera for the World's own box, not the full frame). */
export const questsCam = (frame: number): Cam => ({ ...Q1_CENTRE, zoom: lerp(2.2, 2.35, prog(frame, 510, 539)), tilt: 0, turn: 0 });

// ---- cut 3: MARK ---------------------------------------------------------------------------------

export const PIN_LAND = PIN.dropAt + 6;
/** Where the pin sits on screen: above the chord's keycaps, clear of the word. */
const PIN_AT = { x: 1290, y: 450 };
/** The map's jolt (screen px, down) when the pin lands, a damped bounce. */
export function landingJolt(frame: number): number {
  const n = frame - PIN_LAND;
  return n < 0 ? 0 : 7 * Math.cos(1.25 * n) * Math.exp(-n / 3.2);
}
/** Top-down on the pin with a slow push; the map jolts when the pin lands. */
export function markCam(frame: number): Cam {
  const zoom = lerp(2.52, 2.68, prog(frame, 540, 569));
  const jolt = landingJolt(frame);
  // screen = centre + (p - cam) * zoom, solved for the cam that puts the pin at PIN_AT (+ jolt)
  return { x: PIN.x - (PIN_AT.x - 960) / zoom, y: PIN.y - (PIN_AT.y + jolt - 540) / zoom, zoom, tilt: 0, turn: 0 };
}

// ---- cut 4: DRAW ---------------------------------------------------------------------------------

export const IRIS_FROM = 585;
export const IRIS_TO = 599;
/**
 * Top-down on q1, the loop a little right of centre (clear of the word) and a little high (my marker
 * stays just off the top edge), a slight push that settles by 585.
 */
const drawHold = (frame: number): Cam => ({ x: Q1_CENTRE.x - 60, y: Q1_CENTRE.y + 30, zoom: lerp(2.0, 2.05, prog(frame, 570, IRIS_FROM, easeOutCubic)), tilt: 0, turn: 0 });
/** Holds on the stroke, then pulls out to the hand-off camera (easeInOutQuint) while the iris closes. */
export function drawCam(frame: number): Cam {
  if (frame <= IRIS_FROM) return drawHold(frame);
  return zoomBetween(drawHold(IRIS_FROM), CAM_IRIS, easeInOutQuint(prog(frame, IRIS_FROM, IRIS_TO)));
}

/**
 * The DRAW close-up's hero scale (markers and line weights 2x), easing to 1x with the pull-out on the
 * camera's curve: the whole picture zooms out together, and f599 matches shot 6's minimap, whose World
 * is drawn at screen resolution.
 */
export function drawScale(frame: number): number {
  return Math.pow(2, 1 - easeInOutQuint(prog(frame, IRIS_FROM, IRIS_TO)));
}

/** The frame's corner distance from the centre: an iris this big shows the whole frame. */
const IRIS_OPEN = Math.hypot(960, 540) + 2;
/** Iris radius round the frame centre: full frame at 585, `HANDOFF.iris.r` at 599. */
export function irisRadius(frame: number): number {
  const t = easeInOutQuint(prog(frame, IRIS_FROM, IRIS_TO));
  return t >= 1 ? HANDOFF.iris.r : lerp(IRIS_OPEN, HANDOFF.iris.r, t);
}

// NOMAD's stroke, with the World's own path and progress curve, so the pen tip sits on its head.
const STROKE_D = smoothPath(STROKE.pts);
const STROKE_LEN = getLength(STROKE_D);
export const strokeProgress = (frame: number): number => bezier(0.3, 0, 0.6, 1)(prog(frame, STROKE.drawFrom, STROKE.drawTo));
export function strokeHead(frame: number): Pt {
  const p = getPointAtLength(STROKE_D, STROKE_LEN * strokeProgress(frame)) ?? STROKE.pts[0];
  return { x: p.x, y: p.y };
}

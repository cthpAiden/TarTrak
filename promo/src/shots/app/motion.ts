/**
 * Shot 4 (THE APP), pure timing and geometry. Frames are global (360-479); coordinates are window px:
 * the app window is laid out at 1920 x 1080 and fills the frame at scale 1.
 *
 * - The build: rail, Squad panel, toolbar and status bar arrive; the World's viewport shrinks from the
 *   full frame into the map area with its camera held at CAM_S4_START.
 * - The float: the window lifts into 3D (a pose: scale, rotations, translation) while the map inside zooms
 *   out so NORTH GATE comes into view for its callout.
 * - The push: the window squares up to the camera and dives into the toolbar's route button.
 */
import { CAM_S4_START, project, type Cam } from "../../world/camera.ts";
import { EXTRACTS, ME, MATES, fromBearing, type Pt } from "../../world/data.ts";
import { bezier, easeInExpo, easeInOutCubic, easeOutExpo, lerp, prog, track } from "../../lib/ease.ts";

export const WIN_W = 1920;
export const WIN_H = 1080;
/** app.css: `.rail` 64 px, `.side` 400 px, `.status` 30 px. */
export const RAIL_W = 64;
export const PANEL_W = 400;
export const STATUS_H = 30;
/** Perspective of the stage the window floats in (px); its origin is the frame centre, as is the window's transform-origin. */
export const PERSP = 2200;

// ---------------------------------------------------------------------------------------------
// Toolbar geometry (app.css `.map-toolbar`, `.tool-btn`): 12 px in from the map's top-right corner.

export const TOOLBAR = { right: 12, top: 12, width: 44, pad: 4, gap: 2, btn: 34, border: 1 } as const;
export const TOOLBAR_X = WIN_W - TOOLBAR.right - TOOLBAR.width;
/** Top edge of toolbar button i (0 overlay, 1 follow, 2 route, 3 draw, 4 centre, 5 fit), window px. */
export const toolTop = (i: number): number => TOOLBAR.top + TOOLBAR.border + TOOLBAR.pad + i * (TOOLBAR.btn + TOOLBAR.gap);
export const ROUTE_BTN: Pt = { x: TOOLBAR_X + TOOLBAR.width / 2, y: toolTop(2) + TOOLBAR.btn / 2 };

// ---------------------------------------------------------------------------------------------
// The build (sound: impactLite 360, uiClick 362 / 367 / 372 / 377)

export const BUILD = {
  rail: [360, 372],
  panel: [364, 380],
  toolbar: 368,
  status: [372, 388],
  /** Row i enters at rows + 4i and lands 4 frames later (row ticks 382 / 386 / 390). */
  rows: 378,
} as const;

/** Left edge of the rail: slides in from x -64. */
export const railX = (f: number): number => -RAIL_W * (1 - easeOutExpo(prog(f, BUILD.rail[0], BUILD.rail[1])));
/** 0..1: the Squad panel sliding out from behind the rail. */
export const panelIn = (f: number): number => easeOutExpo(prog(f, BUILD.panel[0], BUILD.panel[1]));
/** Left edge of the panel: its right edge starts hidden under the rail's. */
export const panelX = (f: number): number => railX(f) + RAIL_W - PANEL_W * (1 - panelIn(f));
/** Top edge of the status bar: rises from below the window. */
export const statusTop = (f: number): number => WIN_H - STATUS_H * easeOutExpo(prog(f, BUILD.status[0], BUILD.status[1]));
/** The map area (and the World's viewport): right of the panel, above the status bar. */
export function mapBox(f: number): { x: number; y: number; w: number; h: number } {
  const x = panelX(f) + PANEL_W;
  return { x, y: 0, w: WIN_W - x, h: statusTop(f) };
}

const pad2 = (n: number) => String(n).padStart(2, "0");
/** The status bar's raid clock: 31:59 left at f360, counting down one second per 60 frames. */
export function raidClock(f: number): string {
  const left = 32 * 60 - 1 - Math.floor(Math.max(0, f - 360) / 60);
  return `${pad2(Math.floor(left / 60))}:${pad2(left % 60)}`;
}

// ---------------------------------------------------------------------------------------------
// The map's camera: CAM_S4_START through the build, then a zoom out that frames NORTH GATE (top right)
// with the whole squad still in view.

export const NORTH_GATE = EXTRACTS.find((e) => e.id === "north-gate")!;
export const NOMAD = MATES.find((m) => m.id === "nomad")!;
export const CAM_FLOAT: Cam = { x: 1534, y: 761, zoom: 1.1, tilt: 0, turn: 0 };
export const MAP_MOVE = [380, 406] as const;

export function mapCam(f: number): Cam {
  const t = easeInOutCubic(prog(f, MAP_MOVE[0], MAP_MOVE[1]));
  if (t <= 0) return CAM_S4_START;
  const a = CAM_S4_START, b = CAM_FLOAT;
  // zoom in log space: equal steps read as equal dolly speed
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), zoom: a.zoom * Math.pow(b.zoom / a.zoom, t), tilt: 0, turn: 0 };
}

/** Where world point p is drawn in the window at frame f. */
export function worldToWin(p: Pt, f: number): Pt {
  const box = mapBox(f);
  const q = project(mapCam(f), p, box.w, box.h);
  return { x: box.x + q.x, y: box.y + q.y };
}

/** A point on my heading line, `share` of its 120-unit length out from me. */
export const headingPoint = (share: number): Pt => fromBearing(ME, ME.heading, 60 * share);

// ---------------------------------------------------------------------------------------------
// The window's pose in 3D (sound: whoosh 380 as it lifts)

export type Pose = { s: number; rx: number; ry: number; tx: number; ty: number };
export const IDENTITY: Pose = { s: 1, rx: 0, ry: 0, tx: 0, ty: 0 };

/** The shrink leads the turn, so the side swinging towards the camera never leaves the frame. */
const SHRINK = bezier(0.35, 0, 0.15, 1);

/** 372-446: scale 1 to 0.78, rotateY 0 to -18 to -6 deg, rotateX 0 to 6 to 2 deg, a small shift up and left. */
export function floatPose(f: number): Pose {
  return {
    s: track(f, [[372, 1, SHRINK], [440, 0.78]]),
    ry: track(f, [[378, 0, easeInOutCubic], [408, -18, easeInOutCubic], [446, -6]]),
    rx: track(f, [[378, 0, easeInOutCubic], [408, 6, easeInOutCubic], [446, 2]]),
    tx: track(f, [[372, 0, easeInOutCubic], [440, -24]]),
    ty: track(f, [[372, 0, easeInOutCubic], [440, -30]]),
  };
}

/** Local point p (window px, `z` px in front of the window's plane) under pose `o`, before the translation; k = perspective scale. */
function place(p: Pt, o: Pose, z: number): { X: number; Y: number; k: number } {
  const qx = (p.x - WIN_W / 2) * o.s, qy = (p.y - WIN_H / 2) * o.s;
  const ry = (o.ry * Math.PI) / 180, rx = (o.rx * Math.PI) / 180;
  // rotateY, then rotateX (CSS `rotateX(rx) rotateY(ry) scale(s)` applies right to left)
  const x1 = qx * Math.cos(ry) + z * Math.sin(ry);
  const z1 = -qx * Math.sin(ry) + z * Math.cos(ry);
  const y2 = qy * Math.cos(rx) - z1 * Math.sin(rx);
  const z2 = qy * Math.sin(rx) + z1 * Math.cos(rx);
  return { X: x1, Y: y2, k: PERSP / (PERSP - z2) };
}

/** Where window point p lands on screen under pose `o` (same maths as the CSS transform + stage perspective). */
export function projectWin(p: Pt, o: Pose, z = 0): Pt & { k: number } {
  const { X, Y, k } = place(p, o, z);
  return { x: WIN_W / 2 + (X + o.tx) * k, y: WIN_H / 2 + (Y + o.ty) * k, k };
}

/**
 * The window point which, `z` px in front of the window's plane, lands on screen exactly where window point p
 * (on the plane) does: a callout floating in front of the window keeps its dot on its target as the window
 * turns, instead of sliding off it by parallax. Newton-style steps; converges in a few.
 */
export function liftedAnchor(p: Pt, o: Pose, z: number): Pt {
  const target = projectWin(p, o, 0);
  let q: Pt = { x: p.x, y: p.y };
  for (let i = 0; i < 8; i++) {
    const at = projectWin(q, o, z);
    q = { x: q.x + (target.x - at.x) / (o.s * at.k), y: q.y + (target.y - at.y) / (o.s * at.k) };
  }
  return q;
}

/** The push into the route button (riser 450-480, whoosh 466). The button is 34 px: 30x fills the frame. */
export const PUSH = { from: 450, to: 480, scale: 30, flat: 466 } as const;

/**
 * The window's pose at frame f. After PUSH.from: the scale runs to PUSH.scale on easeInExpo, the tilt
 * eases out to flat by PUSH.flat, and the translation is solved so the route button drifts to the frame
 * centre in step with the zoom (its share of the way = the share of the zoom done, in log scale): a
 * straight dolly towards the button, which is centred as the push reaches PUSH.to.
 */
export function pose(f: number): Pose {
  if (f <= PUSH.from) return floatPose(f);
  const p0 = floatPose(PUSH.from);
  const s = lerp(p0.s, PUSH.scale, easeInExpo(prog(f, PUSH.from, PUSH.to)));
  const r = 1 - easeInOutCubic(prog(f, PUSH.from, PUSH.flat));
  const o: Pose = { s, rx: r > 0 ? p0.rx * r : 0, ry: r > 0 ? p0.ry * r : 0, tx: 0, ty: 0 };
  const b0 = projectWin(ROUTE_BTN, p0);
  const v = Math.log(s / p0.s) / Math.log(PUSH.scale / p0.s);
  const target = { x: lerp(b0.x, WIN_W / 2, v), y: lerp(b0.y, WIN_H / 2, v) };
  const { X, Y, k } = place(ROUTE_BTN, o, 0);
  return { ...o, tx: (target.x - WIN_W / 2) / k - X, ty: (target.y - WIN_H / 2) / k - Y };
}

/** 0..1: how far the window has lifted off the frame (rounded corners, shadow, glow and reflection follow it). */
export const lift = (f: number): number => (f < 372 ? 0 : Math.min(1, (1 - floatPose(f).s) / 0.12));

// ---------------------------------------------------------------------------------------------
// Callouts (sound: plucks 390 / 405 / 420 / 435)

export const CALLOUT_AT = { squad: 390, heading: 405, extracts: 420, clock: 435 } as const;
/** Callouts fade as the push picks up speed; the clock's text finishes typing at 455. */
export const CALLOUT_OUT = [456, 461] as const;
/**
 * Motion blur from here to the cut. The brief says 462, but the push already moves the window's far side
 * 70-160 px a frame over 458-461, which strobes without blur.
 */
export const BLUR_FROM = 458;

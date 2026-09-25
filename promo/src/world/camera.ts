import { track, type Ease } from "../lib/ease.ts";
import { ME, type Pt } from "./data.ts";

/** Focus point in world units, zoom (px per unit), tilt (deg, map lying back), turn (deg the map is turned anticlockwise; heading-up = my heading). */
export type Cam = { x: number; y: number; zoom: number; tilt: number; turn: number };
export type CamKey = readonly [frame: number, cam: Cam, ease?: Ease];
export const PERSPECTIVE = 1800;

export function camAt(frame: number, keys: readonly CamKey[]): Cam {
  const field = (k: keyof Cam) => track(frame, keys.map(([f, c, e]) => [f, c[k], e] as const));
  return { x: field("x"), y: field("y"), zoom: field("zoom"), tilt: field("tilt"), turn: field("turn") };
}

/** CSS transform for the world plane (transform-origin 0 0) in a view w x h whose perspective-origin is its centre. */
export function planeTransform(c: Cam, w: number, h: number): string {
  return `translate(${w / 2}px, ${h / 2}px) rotateX(${c.tilt}deg) rotateZ(${-c.turn}deg) scale3d(${c.zoom}, ${c.zoom}, ${c.zoom}) translate(${-c.x}px, ${-c.y}px)`;
}

/** Local transform (after a translate to the anchor) that makes a child of the plane face the camera at constant pixel size. */
export function billboard(c: Cam): string {
  return `rotateZ(${c.turn}deg) rotateX(${-c.tilt}deg) scale3d(${1 / c.zoom}, ${1 / c.zoom}, ${1 / c.zoom})`;
}

/** Where world point p lands in the view: same maths as planeTransform plus CSS perspective. `s` = perspective scale. */
export function project(c: Cam, p: Pt, w: number, h: number, persp = PERSPECTIVE): { x: number; y: number; s: number } {
  const dx = (p.x - c.x) * c.zoom, dy = (p.y - c.y) * c.zoom;
  const r = (-c.turn * Math.PI) / 180;
  const rx = dx * Math.cos(r) - dy * Math.sin(r);
  const ry = dx * Math.sin(r) + dy * Math.cos(r);
  const t = (c.tilt * Math.PI) / 180;
  const y3 = ry * Math.cos(t), z3 = ry * Math.sin(t);
  const s = persp / (persp - z3);
  return { x: w / 2 + rx * s, y: h / 2 + y3 * s, s };
}

/** `project` for a point `z` world units above the ground (CSS translateZ inside the plane, scaled by zoom). */
export function project3d(c: Cam, p: Pt, z: number, w: number, h: number, persp = PERSPECTIVE): { x: number; y: number; s: number } {
  const dx = (p.x - c.x) * c.zoom, dy = (p.y - c.y) * c.zoom, dz = z * c.zoom;
  const r = (-c.turn * Math.PI) / 180;
  const rx = dx * Math.cos(r) - dy * Math.sin(r);
  const ry = dx * Math.sin(r) + dy * Math.cos(r);
  const t = (c.tilt * Math.PI) / 180;
  const y3 = ry * Math.cos(t) - dz * Math.sin(t), z3 = ry * Math.sin(t) + dz * Math.cos(t);
  const s = persp / (persp - z3);
  return { x: w / 2 + rx * s, y: h / 2 + y3 * s, s };
}

/** Shared cameras at cuts (see timeline HANDOFF). */
export const CAM_S2_START: Cam = { x: ME.x, y: ME.y, zoom: 3.2, tilt: 0, turn: 0 };
export const CAM_S4_START: Cam = { x: ME.x + 40, y: ME.y - 30, zoom: 1.6, tilt: 0, turn: 0 };
/** The round minimap's own camera at natural size (disc radius 165 px). */
export const CAM_MINIMAP: Cam = { x: ME.x, y: ME.y, zoom: 0.55, tilt: 0, turn: 0 };
/** Full-frame camera that matches the minimap zoomed 2x (shot 5's last frame, shot 6's first). */
export const CAM_IRIS: Cam = { ...CAM_MINIMAP, zoom: CAM_MINIMAP.zoom * 2 };

/**
 * Screen layout of the measure pills ("47 m") that sit on the lines from me to each teammate. A pill stays on
 * the middle of its line when there is room; when the markers crowd it (a wide shot), it slides along the line
 * or out to one side, clear of the dots, the name labels and the other pills. Sizes match World.tsx's overlay.
 */
import { clamp } from "../lib/ease.ts";
import { project, type Cam } from "./camera.ts";
import { ME, MATES, mateLabel, type MateId, type Pt } from "./data.ts";

/** Axis-aligned screen box, by its centre. */
export type Box = { x: number; y: number; w: number; h: number };

/** Screen scale of an overlay element at perspective factor s (World.tsx's `At` uses the same clamp). */
export const markerScale = (s: number): number => clamp(s, 0.45, 1.35);

/** Overlay sizes in px at scale 1, as World.tsx draws them; text widths are generous estimates. */
export const SIZES = {
  meDot: 24,
  mateDot: 21,
  /** Name pill: 600 13 px sans caps, padding 3/8, 1 px border; its centre sits `lift` px above the dot. */
  label: { h: 24, char: 9, pad: 18, lift: 28 },
  /** Measure pill: 500 12 px mono, padding 2/7, 1 px border, 6 px colour dot + 6 px gap. */
  pill: { h: 22, char: 8, pad: 30 },
} as const;

export const measureText = (metres: number): string => `${metres} m`;

/** What the pills must stay clear of: my dot, each teammate's dot and name label. */
export function markerBoxes(cam: Cam, w: number, h: number): Array<Box & { what: string }> {
  const me = project(cam, ME, w, h), km = markerScale(me.s);
  const out: Array<Box & { what: string }> = [{ what: "me", x: me.x, y: me.y, w: SIZES.meDot * km, h: SIZES.meDot * km }];
  for (const m of MATES) {
    const p = project(cam, m, w, h), k = markerScale(p.s);
    out.push({ what: `${m.id} dot`, x: p.x, y: p.y, w: SIZES.mateDot * k, h: SIZES.mateDot * k });
    const L = SIZES.label;
    out.push({ what: `${m.id} label`, x: p.x, y: p.y - L.lift * k, w: (L.pad + mateLabel(m).length * L.char) * k, h: L.h * k });
  }
  return out;
}

const area = (a: Box, b: Box): number =>
  Math.max(0, Math.min(a.x + a.w / 2, b.x + b.w / 2) - Math.max(a.x - a.w / 2, b.x - b.w / 2)) *
  Math.max(0, Math.min(a.y + a.h / 2, b.y + b.h / 2) - Math.max(a.y - a.h / 2, b.y - b.h / 2));

/** Does segment p-q pass through box b (Liang-Barsky)? */
function crosses(p: Pt, q: Pt, b: Box): boolean {
  const dx = q.x - p.x, dy = q.y - p.y;
  let t0 = 0, t1 = 1;
  const edges: Array<[number, number]> = [
    [-dx, p.x - (b.x - b.w / 2)], [dx, b.x + b.w / 2 - p.x],
    [-dy, p.y - (b.y - b.h / 2)], [dy, b.y + b.h / 2 - p.y],
  ];
  for (const [pp, qq] of edges) {
    if (pp === 0) {
      if (qq < 0) return false;
      continue;
    }
    const r = qq / pp;
    if (pp < 0) {
      if (r > t1) return false;
      t0 = Math.max(t0, r);
    } else {
      if (r < t0) return false;
      t1 = Math.min(t1, r);
    }
  }
  return true;
}

/** Where along the line (0 = me, 1 = teammate) and how far to one side (px at scale 1) a pill may go, best first. */
const ALONG = [0.5, 0.42, 0.58, 0.34, 0.66, 0.26, 0.74, 0.18, 0.82, 0.9, 1, 1.1];
const ASIDE = [0, 10, 18, 26, 34, 42, 50, 58, 66, 76].flatMap((o) => (o ? [o, -o] : [0]));
/** Clearance kept round every box while placing (px). */
const GAP = 3;
/** Lines shorter than this (px) fade their pill out; from FULL px up it is fully shown. */
const FADE = { none: 26, full: 44 };

export type Pill = Box & { id: MateId; metres: number; k: number; fade: number; t: number; offset: number };

/** Pill boxes in MATES order. Placement depends on the camera only (not on the counting text), so pills never jitter. */
export function measurePills(cam: Cam, w: number, h: number): Pill[] {
  const me = project(cam, ME, w, h);
  const markers = markerBoxes(cam, w, h);
  const ends = MATES.map((m) => ({ m, p: project(cam, m, w, h) }));
  const cx = (me.x + ends.reduce((s, e) => s + e.p.x, 0)) / (ends.length + 1);
  const cy = (me.y + ends.reduce((s, e) => s + e.p.y, 0)) / (ends.length + 1);
  const len = (p: Pt) => Math.hypot(p.x - me.x, p.y - me.y);
  const placed: Pill[] = [];
  for (const { m, p } of [...ends].sort((a, b) => len(a.p) - len(b.p))) {
    const L = len(p);
    const u = L > 1e-6 ? { x: (p.x - me.x) / L, y: (p.y - me.y) / L } : { x: 1, y: 0 };
    const mid = { x: (me.x + p.x) / 2, y: (me.y + p.y) / 2 };
    // "outward" = away from the middle of the group, so crowded pills fan out rather than pile up
    const side = -u.y * (mid.x - cx) + u.x * (mid.y - cy) >= 0 ? 1 : -1;
    const n = { x: -u.y * side, y: u.x * side };
    const k = markerScale(project(cam, { x: (ME.x + m.x) / 2, y: (ME.y + m.y) / 2 }, w, h).s);
    const pw = (SIZES.pill.pad + measureText(m.metres).length * SIZES.pill.char) * k, ph = SIZES.pill.h * k;
    const others = ends.filter((e) => e.m !== m).map((e) => e.p);
    let best: { cost: number; box: Box; t: number; o: number } | null = null;
    for (const t of ALONG) for (const o of ASIDE) {
      const box = { x: me.x + (p.x - me.x) * t + n.x * o * k, y: me.y + (p.y - me.y) * t + n.y * o * k, w: pw, h: ph };
      const grown = { ...box, w: box.w + 2 * GAP, h: box.h + 2 * GAP };
      const hit = markers.reduce((s, b) => s + area(grown, b), 0) + placed.reduce((s, b) => s + area(grown, b), 0);
      const cuts = others.filter((q) => crosses(me, q, box)).length;
      const cost = hit * 1e4 + Math.abs(t - 0.5) * L + 1.4 * Math.abs(o) * k + (o < 0 ? 12 : 0) + cuts * 30;
      if (!best || cost < best.cost) best = { cost, box, t, o };
    }
    const f = clamp((L - FADE.none) / (FADE.full - FADE.none));
    placed.push({ ...best!.box, id: m.id, metres: m.metres, k, fade: f * f * (3 - 2 * f), t: best!.t, offset: best!.o });
  }
  return MATES.map((m) => placed.find((q) => q.id === m.id)!);
}

import { WORLD_H, WORLD_W, type Pt } from "./data.ts";

export type Hill = { x: number; y: number; s: number; a: number };
export const HILLS: readonly Hill[] = [
  { x: 420, y: 300, s: 380, a: 0.9 },
  { x: 1100, y: 1700, s: 420, a: 0.7 },
  { x: 2750, y: 1750, s: 360, a: 0.8 },
  { x: 2000, y: 350, s: 300, a: 0.55 },
  { x: 1500, y: 1450, s: 220, a: 0.35 },
  { x: 250, y: 1400, s: 300, a: 0.6 },
  { x: 2900, y: 400, s: 260, a: 0.65 },
  { x: 900, y: 1100, s: 200, a: 0.25 },
];
export function heightAt(x: number, y: number): number {
  let h = 0.12 + 0.05 * Math.sin(x / 310) * Math.cos(y / 270);
  for (const k of HILLS) h += k.a * Math.exp(-((x - k.x) ** 2 + (y - k.y) ** 2) / (2 * k.s * k.s));
  return Math.max(0, Math.min(1.5, h));
}
export const CONTOUR_LEVELS = [0.18, 0.26, 0.34, 0.42, 0.5, 0.58, 0.66, 0.74, 0.82, 0.9] as const;

// Edge pairs per marching-squares case. Corners: tl=8, tr=4, br=2, bl=1. Edges: 0 top, 1 right, 2 bottom, 3 left.
const SEGS: Record<number, number[][]> = {
  1: [[3, 2]], 2: [[2, 1]], 3: [[3, 1]], 4: [[0, 1]], 6: [[0, 2]], 7: [[3, 0]],
  8: [[3, 0]], 9: [[0, 2]], 11: [[0, 1]], 12: [[3, 1]], 13: [[2, 1]], 14: [[3, 2]],
};

type Field = (x: number, y: number) => number;
/** One iso-line segment; `ka`/`kb` name the grid edges its ends lie on (shared by neighbouring cells). */
type Seg = { ka: string; a: [number, number]; kb: string; b: [number, number] };

/** Marching-squares segments of `field` at `level` over [0, w] x [0, h]. */
function isoSegments(level: number, cell: number, w: number, h: number, field: Field): Seg[] {
  const cols = Math.ceil(w / cell), rows = Math.ceil(h / cell);
  const v: number[][] = [];
  for (let j = 0; j <= rows; j++) {
    const row: number[] = [];
    for (let i = 0; i <= cols; i++) row.push(field(i * cell, j * cell));
    v.push(row);
  }
  const out: Seg[] = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const tl = v[j][i], tr = v[j][i + 1], br = v[j + 1][i + 1], bl = v[j + 1][i];
    const idx = (tl >= level ? 8 : 0) | (tr >= level ? 4 : 0) | (br >= level ? 2 : 0) | (bl >= level ? 1 : 0);
    if (idx === 0 || idx === 15) continue;
    const x0 = i * cell, y0 = j * cell;
    const t = (a: number, b: number) => (level - a) / (b - a);
    const edge = (e: number): [number, number] =>
      e === 0 ? [x0 + t(tl, tr) * cell, y0]
      : e === 1 ? [x0 + cell, y0 + t(tr, br) * cell]
      : e === 2 ? [x0 + t(bl, br) * cell, y0 + cell]
      : [x0, y0 + t(tl, bl) * cell];
    const key = (e: number): string =>
      e === 0 ? `h${i},${j}` : e === 1 ? `v${i + 1},${j}` : e === 2 ? `h${i},${j + 1}` : `v${i},${j}`;
    let segs = SEGS[idx];
    if (idx === 5 || idx === 10) {
      const centreHigh = (tl + tr + br + bl) / 4 >= level;
      segs = idx === 5 ? (centreHigh ? [[3, 0], [2, 1]] : [[3, 2], [0, 1]]) : (centreHigh ? [[0, 1], [3, 2]] : [[3, 0], [2, 1]]);
    }
    for (const [ea, eb] of segs) out.push({ ka: key(ea), a: edge(ea), kb: key(eb), b: edge(eb) });
  }
  return out;
}

/** Marching-squares iso-line of `field` at `level`, as one SVG path of "M x y L x y" segments. */
export function contourPath(level: number, cell = 20, w = WORLD_W, h = WORLD_H, field: Field = heightAt): string {
  const r2 = (n: number) => Math.round(n * 100) / 100;
  return isoSegments(level, cell, w, h, field).map(({ a, b }) => `M${r2(a[0])} ${r2(a[1])}L${r2(b[0])} ${r2(b[1])}`).join("");
}

/** The same iso-line joined into polylines (closed rings and open lines ending at the border), for smoothing. */
export function contourLines(level: number, cell = 20, w = WORLD_W, h = WORLD_H, field: Field = heightAt): Array<{ pts: Pt[]; closed: boolean }> {
  const segs = isoSegments(level, cell, w, h, field);
  const at = new Map<string, number[]>();
  const pointOf = new Map<string, Pt>();
  segs.forEach((s, i) => {
    for (const [k, p] of [[s.ka, s.a], [s.kb, s.b]] as const) {
      at.set(k, [...(at.get(k) ?? []), i]);
      pointOf.set(k, { x: p[0], y: p[1] });
    }
  });
  const used = new Set<number>();
  const walk = (start: string): { pts: Pt[]; closed: boolean } => {
    const pts: Pt[] = [pointOf.get(start)!];
    let k = start;
    for (;;) {
      const next = (at.get(k) ?? []).find((i) => !used.has(i));
      if (next === undefined) return { pts, closed: false };
      used.add(next);
      k = segs[next].ka === k ? segs[next].kb : segs[next].ka;
      if (k === start) return { pts, closed: true };
      pts.push(pointOf.get(k)!);
    }
  };
  const lines: Array<{ pts: Pt[]; closed: boolean }> = [];
  for (const [k, list] of at) if (list.length === 1 && !used.has(list[0])) lines.push(walk(k));
  segs.forEach((s, i) => {
    if (!used.has(i)) lines.push(walk(s.ka));
  });
  return lines;
}

/**
 * The one light of the map: compass bearing it comes from and its height (deg). The hillshade and the
 * buildings' walls and shadows (World.tsx) both use it. West-south-west, so the walls facing the tilted
 * cameras of shots 2-3 (which look from the south-east) split into one lit and one shaded face.
 */
export const SUN = { az: 250, el: 45 } as const;
/** Unit vector towards the sun (x east, y south, z up). */
const LIGHT = (() => {
  const a = (SUN.az * Math.PI) / 180, e = (SUN.el * Math.PI) / 180;
  return { x: Math.sin(a) * Math.cos(e), y: -Math.cos(a) * Math.cos(e), z: Math.sin(e) };
})();
/** Hillshade relief exaggerated so gentle hills still read. */
const RELIEF = { exaggerate: 420, strength: 0.6, altitude: 0.16 };
function toneFrom(h: number, gx: number, gy: number): number {
  const nx = -RELIEF.exaggerate * gx, ny = -RELIEF.exaggerate * gy;
  const d = (nx * LIGHT.x + ny * LIGHT.y + LIGHT.z) / Math.hypot(nx, ny, 1);
  return 1 + RELIEF.strength * (d - LIGHT.z) + RELIEF.altitude * (h - 0.3);
}

/** Brightness multiplier of the ground at (x, y): about 1 on flat ground, above on lit slopes and high ground. */
export function groundTone(x: number, y: number): number {
  const e = 5;
  const gx = (heightAt(x + e, y) - heightAt(x - e, y)) / (2 * e);
  const gy = (heightAt(x, y + e) - heightAt(x, y - e)) / (2 * e);
  return toneFrom(heightAt(x, y), gx, gy);
}

/** `groundTone` on a cols x rows grid from (x0, y0), `step` apart (row-major); step 5 matches groundTone exactly. */
export function toneGrid(x0: number, y0: number, step: number, cols: number, rows: number): Float32Array {
  const W = cols + 2;
  const hs = new Float64Array(W * (rows + 2));
  for (let j = 0; j < rows + 2; j++) for (let i = 0; i < W; i++) hs[j * W + i] = heightAt(x0 + (i - 1) * step, y0 + (j - 1) * step);
  const out = new Float32Array(cols * rows);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const c = (j + 1) * W + i + 1;
    out[j * cols + i] = toneFrom(hs[c], (hs[c + 1] - hs[c - 1]) / (2 * step), (hs[c + W] - hs[c - W]) / (2 * step));
  }
  return out;
}

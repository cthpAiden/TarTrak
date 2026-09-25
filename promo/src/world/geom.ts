import type { Pt } from "./data.ts";

const r2 = (n: number) => Math.round(n * 100) / 100;
const fmt = (p: Pt) => `${r2(p.x)} ${r2(p.y)}`;

/** Cubic Bezier control points of the uniform Catmull-Rom segment from pts[i] to pts[i + 1]. */
function segment(pts: readonly Pt[], i: number, closed: boolean): [Pt, Pt, Pt, Pt] {
  const n = pts.length;
  const at = (k: number) => (closed ? pts[((k % n) + n) % n] : pts[Math.max(0, Math.min(n - 1, k))]);
  const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
  return [
    p1,
    { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 },
    { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 },
    p2,
  ];
}
const segCount = (n: number, closed: boolean) => (closed ? n : n - 1);

/** Smooth SVG path through every point (Catmull-Rom as cubic Beziers). */
export function smoothPath(pts: readonly Pt[], closed = false): string {
  if (pts.length < 2) return "";
  let d = `M${fmt(pts[0])}`;
  for (let i = 0; i < segCount(pts.length, closed); i++) {
    const [, c1, c2, p2] = segment(pts, i, closed);
    d += `C${fmt(c1)} ${fmt(c2)} ${fmt(p2)}`;
  }
  return closed ? `${d}Z` : d;
}

/** The same curve as `smoothPath`, as a dense polyline (`perSeg` points per segment). */
export function sampleSmooth(pts: readonly Pt[], closed = false, perSeg = 12): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < segCount(pts.length, closed); i++) {
    const [a, b, c, d] = segment(pts, i, closed);
    out.push(a);
    for (let k = 1; k < perSeg; k++) {
      const t = k / perSeg, u = 1 - t;
      const w0 = u * u * u, w1 = 3 * u * u * t, w2 = 3 * u * t * t, w3 = t * t * t;
      out.push({ x: w0 * a.x + w1 * b.x + w2 * c.x + w3 * d.x, y: w0 * a.y + w1 * b.y + w2 * c.y + w3 * d.y });
    }
  }
  if (!closed && pts.length > 0) out.push(pts[pts.length - 1]);
  return out;
}

/** Unit tangent at point i of a polyline (from its neighbours). */
function tangent(line: readonly Pt[], i: number): Pt {
  const a = line[Math.max(0, i - 1)], b = line[Math.min(line.length - 1, i + 1)];
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  return { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
}

/** The polyline moved sideways by d (positive = to the right of travel on a y-down screen). */
export function offsetLine(line: readonly Pt[], d: number): Pt[] {
  return line.map((p, i) => {
    const t = tangent(line, i);
    return { x: p.x - t.y * d, y: p.y + t.x * d };
  });
}

/** Points every `every` units along a polyline (starting half a step in), with the unit normal there. */
export function stations(line: readonly Pt[], every: number): Array<Pt & { nx: number; ny: number }> {
  const out: Array<Pt & { nx: number; ny: number }> = [];
  let next = every / 2, walked = 0;
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i], b = line[i + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len === 0) continue;
    const tx = (b.x - a.x) / len, ty = (b.y - a.y) / len;
    while (next <= walked + len) {
      const u = next - walked;
      out.push({ x: a.x + tx * u, y: a.y + ty * u, nx: -ty, ny: tx });
      next += every;
    }
    walked += len;
  }
  return out;
}

/** Convex hull (monotone chain), without collinear points. */
export function convexHull(pts: readonly Pt[]): Pt[] {
  const p = [...pts].sort((a, b) => a.x - b.x || a.y - b.y);
  if (p.length < 3) return p;
  const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Pt[] = [], upper: Pt[] = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/** Adds a point `by` units beyond each end, continuing the end segments (roads that run off the map). */
export function extendEnds(pts: readonly Pt[], by: number): Pt[] {
  const ext = (a: Pt, b: Pt): Pt => {
    const len = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    return { x: a.x + ((a.x - b.x) / len) * by, y: a.y + ((a.y - b.y) / len) * by };
  };
  const n = pts.length;
  return [ext(pts[0], pts[1]), ...pts, ext(pts[n - 1], pts[n - 2])];
}

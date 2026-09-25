export type Ease = (t: number) => number;
export const clamp = (v: number, lo = 0, hi = 1): number => Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const linear: Ease = (t) => t;

/** CSS cubic-bezier(x1, y1, x2, y2). y may leave 0..1 (overshoot). */
export function bezier(x1: number, y1: number, x2: number, y2: number): Ease {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sy = (t: number) => ((ay * t + by) * t + cy) * t;
  const dsx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const err = sx(t) - x;
      if (Math.abs(err) < 1e-6) return sy(t);
      const d = dsx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= err / d;
    }
    let lo = 0, hi = 1;
    t = x;
    for (let i = 0; i < 40; i++) {
      const v = sx(t);
      if (Math.abs(v - x) < 1e-7) break;
      if (v < x) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return sy(t);
  };
}

export const easeOutExpo = bezier(0.16, 1, 0.3, 1);
export const easeInExpo = bezier(0.7, 0, 0.84, 0);
export const easeInOutQuint = bezier(0.83, 0, 0.17, 1);
export const easeOutCubic = bezier(0.33, 1, 0.68, 1);
export const easeInCubic = bezier(0.32, 0, 0.67, 0);
export const easeInOutCubic = bezier(0.65, 0, 0.35, 1);
export const easeOutBack = bezier(0.34, 1.56, 0.64, 1);

/** Eased 0..1 progress of `frame` through [f0, f1]: 0 before, 1 after. */
export function prog(frame: number, f0: number, f1: number, ease: Ease = linear): number {
  if (f1 <= f0) return frame >= f0 ? 1 : 0;
  return ease(clamp((frame - f0) / (f1 - f0)));
}

export type Key = readonly [frame: number, value: number, ease?: Ease];
/** Keyframed value. Holds the first value before the first key and the last after the last; a segment uses its starting key's ease (default easeInOutCubic). */
export function track(frame: number, keys: readonly Key[]): number {
  if (keys.length === 0) return 0;
  if (frame <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [f0, v0, e] = keys[i];
    const [f1, v1] = keys[i + 1];
    if (frame < f1) return lerp(v0, v1, prog(frame, f0, f1, e ?? easeInOutCubic));
  }
  return keys[keys.length - 1][1];
}

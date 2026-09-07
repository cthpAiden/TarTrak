/**
 * Bearings for the overlay's compass tape. Same convention as the heading line in markers.ts:
 * yaw in degrees [0, 360), forward = (sin yaw, cos yaw) on game (x, z), so a teammate the line
 * points at sits under the centre marker.
 */

export interface CompassTarget {
  id: string;
  bearing: number;
  color: string;
  label: string;
  kind: "route" | "mate";
}

/** Tape scale: a 324px-wide window shows 108°. */
export const PX_PER_DEG = 3;

function norm360(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/** True bearing from one point to another, [0, 360); 0 for a zero vector. */
export function bearingDeg(from: { x: number; z: number }, to: { x: number; z: number }): number {
  return norm360((Math.atan2(to.x - from.x, to.z - from.z) * 180) / Math.PI);
}

/** Signed offset of a bearing from a heading, [-180, 180): negative is to my left. */
export function relativeDeg(bearing: number, heading: number): number {
  return norm360(bearing - heading + 180) - 180;
}

/** One tick per 10° of true bearing on the tape; the heading sits at widthPx / 2. Labels go on major ticks. */
export function tapeTicks(heading: number, widthPx: number, pxPerDeg = PX_PER_DEG): { deg: number; x: number; major: boolean }[] {
  const half = widthPx / 2;
  const first = Math.ceil((heading - half / pxPerDeg) / 10) * 10;
  const ticks: { deg: number; x: number; major: boolean }[] = [];
  for (let d = first; ; d += 10) {
    const x = half + (d - heading) * pxPerDeg;
    if (x > widthPx) break;
    const deg = norm360(d);
    ticks.push({ deg, x, major: deg % 30 === 0 });
  }
  return ticks;
}

/** Where a bearing lands on the tape; off the tape it is pinned to the edge it lies beyond. */
export function tapePosition(
  bearing: number,
  heading: number,
  widthPx: number,
  pxPerDeg = PX_PER_DEG,
  inset = 6,
): { x: number; clamped: boolean } {
  const x = widthPx / 2 + relativeDeg(bearing, heading) * pxPerDeg;
  if (x < inset) return { x: inset, clamped: true };
  if (x > widthPx - inset) return { x: widthPx - inset, clamped: true };
  return { x, clamped: false };
}

/** "041": whole degrees, three digits, as bearings are called out. */
export function pad3(deg: number): string {
  return String(norm360(Math.round(deg))).padStart(3, "0");
}

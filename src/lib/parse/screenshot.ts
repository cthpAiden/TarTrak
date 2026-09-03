export interface Position {
  x: number;
  y: number;
  z: number;
  /** Compass heading in degrees, [0, 360). */
  yaw: number;
}

const NUM = "(-?\\d+(?:\\.\\d+)?)";
const SCREENSHOT_RE = new RegExp(
  "^\\d{4}-\\d{2}-\\d{2}\\[\\d{2}-\\d{2}(?:-\\d{2})?\\]_" +
    `${NUM}, ${NUM}, ${NUM}_` +
    `${NUM}, ${NUM}, ${NUM}, ${NUM}` +
    "(?:_-?\\d+(?:\\.\\d+)?)?" +
    "(?: \\(\\d+\\))?" +
    "\\.png$",
  "i",
);

/**
 * Heading from a Unity (y-up) quaternion. Rotates forward (0,0,1) and takes
 * the angle of its x/z projection, so pitch and roll do not affect the result.
 */
export function yawFromQuaternion(rx: number, ry: number, rz: number, rw: number): number {
  const fx = 2 * (rx * rz + rw * ry);
  const fz = 1 - 2 * (rx * rx + ry * ry);
  const deg = (Math.atan2(fx, fz) * 180) / Math.PI;
  return ((deg % 360) + 360) % 360;
}

export function parseScreenshotName(name: string): Position | null {
  const m = SCREENSHOT_RE.exec(name);
  if (!m) return null;
  const [x, y, z, rx, ry, rz, rw] = m.slice(1, 8).map(Number);
  if ([x, y, z, rx, ry, rz, rw].some((n) => !Number.isFinite(n))) return null;
  return { x, y, z, yaw: yawFromQuaternion(rx, ry, rz, rw) };
}

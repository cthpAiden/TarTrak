/** One raid as the replay needs it: my screenshots and every teammate's positions, in this PC's clock. */

/** A position at a moment: `t` is epoch ms on this PC's clock. Game coordinates and yaw like a Position. */
export interface TrailPoint {
  t: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
}

export interface MateTrail {
  /** Teammates are kept by name: their relay id changes every time they reconnect. */
  name: string;
  /** The colour they sent; the screen may show them in one I picked instead. */
  color: string;
  points: TrailPoint[];
}

export interface RaidRecord {
  /** Map key; null until the game log or a screenshot says which map. */
  map: string | null;
  /** When I spawned, from the game's raid clock line. Also the record's id. */
  startedAt: number;
  /** When the raid itself ends; teammates are recorded up to here after I leave. */
  endsAt: number;
  /** When I left the raid; null while I am in it. */
  leftAt: number | null;
  me: TrailPoint[];
  mates: MateTrail[];
}

/** Bounds a trail, so a stuck loop can never grow a saved raid without end. */
export const MAX_TRAIL_POINTS = 5000;

export function startRaid(map: string | null, startedAt: number, endsAt: number): RaidRecord {
  return { map, startedAt, endsAt, leftAt: null, me: [], mates: [] };
}

/** Worth keeping and replaying: on a known map, with at least one screenshot of mine. */
export function keepRaid(r: RaidRecord): boolean {
  return r.map !== null && r.me.length > 0;
}

/** My screenshot at `at`; null when the raid no longer takes it (I left, or the trail is full). */
export function addOwn(r: RaidRecord, map: string | null, p: Omit<TrailPoint, "t">, at: number): RaidRecord | null {
  if (r.leftAt !== null || r.me.length >= MAX_TRAIL_POINTS) return null;
  const { x, y, z, yaw } = p;
  return { ...r, map: r.map ?? map, me: [...r.me, { t: at, x, y, z, yaw }] };
}

export interface MateUpdate {
  name: string;
  color: string;
  map: string | null;
  x: number;
  y: number;
  z: number;
  yaw: number;
  /** When it reached this PC. */
  receivedAt: number;
}

/**
 * A teammate's position; null when it is not part of this raid. Taken from my spawn to the raid's end, and
 * after I leave only if I took a screenshot in it. A teammate without a map in the log is taken as on mine,
 * like the live map does. A position equal to their last one is a resend (reconnect, rejoin), not a screenshot.
 */
export function addMate(r: RaidRecord, m: MateUpdate): RaidRecord | null {
  if (m.receivedAt < r.startedAt || m.receivedAt > r.endsAt) return null;
  if (r.leftAt !== null && r.me.length === 0) return null;
  if (r.map === null || (m.map !== null && m.map !== r.map)) return null;
  const i = r.mates.findIndex((t) => t.name === m.name);
  const trail = i >= 0 ? r.mates[i] : { name: m.name, color: m.color, points: [] };
  const last = trail.points[trail.points.length - 1];
  if (last && last.x === m.x && last.y === m.y && last.z === m.z && last.yaw === m.yaw) return null;
  if (trail.points.length >= MAX_TRAIL_POINTS) return null;
  const next: MateTrail = {
    name: m.name,
    color: m.color,
    points: [...trail.points, { t: m.receivedAt, x: m.x, y: m.y, z: m.z, yaw: m.yaw }],
  };
  const mates = i >= 0 ? r.mates.map((t, j) => (j === i ? next : t)) : [...r.mates, next];
  return { ...r, mates };
}

const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function coercePoints(v: unknown): TrailPoint[] {
  if (!Array.isArray(v)) return [];
  const out: TrailPoint[] = [];
  for (const p of v.slice(0, MAX_TRAIL_POINTS)) {
    if (typeof p !== "object" || p === null) continue;
    const { t, x, y, z, yaw } = p as Record<string, unknown>;
    if (num(t) && num(x) && num(y) && num(z) && num(yaw)) out.push({ t, x, y, z, yaw });
  }
  return out;
}

/** One saved raid as read back from disk; null for anything that is not one. */
export function coerceRaid(v: unknown): RaidRecord | null {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  if (typeof o.map !== "string" || !num(o.startedAt) || !num(o.endsAt)) return null;
  const leftAt = num(o.leftAt) ? o.leftAt : null;
  const mates: MateTrail[] = [];
  if (Array.isArray(o.mates)) {
    for (const m of o.mates) {
      if (typeof m !== "object" || m === null) continue;
      const { name, color, points } = m as Record<string, unknown>;
      if (typeof name === "string" && typeof color === "string") mates.push({ name, color, points: coercePoints(points) });
    }
  }
  const r: RaidRecord = { map: o.map, startedAt: o.startedAt, endsAt: o.endsAt, leftAt, me: coercePoints(o.me), mates };
  return keepRaid(r) ? r : null;
}

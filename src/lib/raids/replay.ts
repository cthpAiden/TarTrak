import type { RaidRecord, TrailPoint } from "./record";

/** A gap between my screenshots longer than this is shaded on my lane. */
export const LONG_GAP_MS = 60_000;
/** The bright end of each trail on the replay map: the last few minutes before the playhead. */
export const TAIL_MS = 180_000;

/** The replay's timeline: from my spawn to whichever came last, my leaving or anyone's last position. */
export function raidSpan(r: RaidRecord): { start: number; end: number } {
  let end = r.leftAt ?? r.startedAt;
  for (const p of r.me) end = Math.max(end, p.t);
  for (const m of r.mates) for (const p of m.points) end = Math.max(end, p.t);
  return { start: r.startedAt, end };
}

export interface ShotStats {
  count: number;
  /** Seconds per screenshot over my time in the raid, rounded. */
  everyS: number;
  longestMs: number;
  /** My gaps over LONG_GAP_MS, as epoch ms. */
  gaps: { from: number; to: number }[];
}

/** My screenshots over my time in the raid: spawn to leaving (or to my last screenshot while still in it). */
export function shotStats(r: RaidRecord): ShotStats {
  const times = r.me.map((p) => p.t);
  const end = r.leftAt ?? times[times.length - 1] ?? r.startedAt;
  const edges = [r.startedAt, ...times, end];
  let longestMs = 0;
  const gaps: { from: number; to: number }[] = [];
  for (let i = 1; i < edges.length; i++) {
    const g = edges[i] - edges[i - 1];
    if (g > longestMs) longestMs = g;
    if (g > LONG_GAP_MS) gaps.push({ from: edges[i - 1], to: edges[i] });
  }
  const everyS = times.length > 0 ? Math.round((end - r.startedAt) / 1000 / times.length) : 0;
  return { count: times.length, everyS, longestMs, gaps };
}

/** "17:20": minutes and seconds, minutes uncapped. */
export function mmss(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export interface TrailAt {
  /** Positions before the tail, drawn faint. Ends where the tail starts, so the two join. */
  old: TrailPoint[];
  /** Positions in the last TAIL_MS up to the playhead, drawn bright. */
  tail: TrailPoint[];
  /** The newest position at the playhead; null before the first. */
  last: TrailPoint | null;
}

/** A trail cut at the playhead `at`: what is drawn faint, what bright, and where the marker stands. */
export function trailAt(points: TrailPoint[], at: number, tailMs: number = TAIL_MS): TrailAt {
  let n = 0;
  while (n < points.length && points[n].t <= at) n++;
  const shown = points.slice(0, n);
  let k = 0;
  while (k < shown.length && shown[k].t < at - tailMs) k++;
  // The faint part runs on to the first bright point, so the line has no hole where they meet.
  const old = k > 0 ? shown.slice(0, Math.min(k + 1, shown.length)) : [];
  return { old, tail: shown.slice(k), last: shown[n - 1] ?? null };
}

/** My screenshot just before or after `at`, for the step buttons; null when there is none that way. */
export function stepShot(r: RaidRecord, at: number, dir: -1 | 1): number | null {
  if (dir > 0) return r.me.find((p) => p.t > at)?.t ?? null;
  for (let i = r.me.length - 1; i >= 0; i--) if (r.me[i].t < at) return r.me[i].t;
  return null;
}

import { C } from "../theme.ts";
import { clamp, easeOutCubic } from "../lib/ease.ts";
import { rng } from "../lib/random.ts";

export const WORLD_W = 3000;
export const WORLD_H = 2000;
export const M_PER_UNIT = 0.5;
export type Pt = { x: number; y: number };

/** Point `metres` from `o` at compass bearing `deg` (0 = north = up, clockwise). */
export function fromBearing(o: Pt, deg: number, metres: number): Pt {
  const r = (deg * Math.PI) / 180, d = metres / M_PER_UNIT;
  return { x: o.x + Math.sin(r) * d, y: o.y - Math.cos(r) * d };
}
export const distM = (a: Pt, b: Pt): number => Math.hypot(a.x - b.x, a.y - b.y) * M_PER_UNIT;
export function bearingDeg(from: Pt, to: Pt): number {
  const d = (Math.atan2(to.x - from.x, -(to.y - from.y)) * 180) / Math.PI;
  return (d + 360) % 360;
}

export const ME = { x: 1400, y: 1050, heading: 48 } as const;

export type MateId = "ghost" | "nomad" | "vex";
export type Mate = Pt & { id: MateId; name: string; color: string; floor: string | null; heading: number; bearing: number; metres: number; landAt: number };
const mate = (id: MateId, name: string, color: string, floor: string | null, bearing: number, metres: number, heading: number, landAt: number): Mate =>
  ({ id, name, color, floor, bearing, metres, heading, landAt, ...fromBearing(ME, bearing, metres) });
export const MATES: readonly Mate[] = [
  mate("ghost", "GHOST", C.ghost, null, 300, 47, 20, 270),
  mate("nomad", "NOMAD", C.nomad, "2F", 150, 84, 250, 285),
  mate("vex", "VEX", C.vex, null, 20, 132, 95, 300),
];
/** Label as the app writes it: "NOMAD [2F]". */
export const mateLabel = (m: Mate): string => (m.floor ? `${m.name} [${m.floor}]` : m.name);

export type ExtractKind = "pmc" | "scav" | "shared";
export type Extract = Pt & { id: string; name: string; kind: ExtractKind; popAt: number };
export const EXTRACTS: readonly Extract[] = [
  { id: "north-gate", name: "NORTH GATE", kind: "pmc", ...fromBearing(ME, 35, 412), popAt: 150 },
  { id: "rail-bridge", name: "RAIL BRIDGE", kind: "shared", x: 2470, y: 700, popAt: 165 },
  { id: "old-depot", name: "OLD DEPOT", kind: "pmc", x: 520, y: 1650, popAt: 180 },
  { id: "pier-4", name: "PIER 4", kind: "scav", x: 2330, y: 1560, popAt: 195 },
  { id: "tunnel", name: "TUNNEL", kind: "scav", x: 260, y: 560, popAt: 210 },
];
export const ROUTE_TARGET = "north-gate";
export const extractColor = (k: ExtractKind): string => (k === "pmc" ? C.extractPmc : k === "scav" ? C.extractScav : C.extractShared);

/** Polylines (smoothed when drawn). */
export const RIVER: readonly Pt[] = [{ x: 2600, y: -40 }, { x: 2450, y: 500 }, { x: 2550, y: 1000 }, { x: 2350, y: 1500 }, { x: 2450, y: 2040 }];
export const ROADS: ReadonlyArray<{ w: number; pts: readonly Pt[] }> = [
  { w: 22, pts: [{ x: -40, y: 1230 }, { x: 600, y: 1180 }, { x: 1200, y: 1210 }, { x: 1800, y: 1170 }, { x: 2400, y: 1220 }, { x: 3040, y: 1180 }] },
  { w: 20, pts: [{ x: 1250, y: 2040 }, { x: 1320, y: 1600 }, { x: 1400, y: 1230 }, { x: 1560, y: 800 }, { x: 1873, y: 375 }, { x: 2000, y: -40 }] },
  { w: 12, pts: [{ x: 600, y: 1180 }, { x: 520, y: 800 }, { x: 700, y: 450 }, { x: 1100, y: 300 }, { x: 1560, y: 800 }] },
];
export const RAIL: readonly Pt[] = [{ x: -40, y: 560 }, { x: 800, y: 600 }, { x: 1600, y: 640 }, { x: 2400, y: 700 }, { x: 3040, y: 740 }];

export const AREAS: ReadonlyArray<Pt & { name: string }> = [
  { name: "SAWMILL", x: 700, y: 850 },
  { name: "RAIL YARD", x: 1150, y: 520 },
  { name: "DEPOT", x: 650, y: 1550 },
  { name: "RIVERSIDE", x: 2080, y: 1450 },
  { name: "POWER STATION", x: 1950, y: 900 },
];

export type Building = Pt & { w: number; h: number; angle: number; height: number };
const CLUSTERS = [
  { x: 700, y: 850, w: 420, h: 300, angle: -8, cols: 5, rows: 3 },
  { x: 1150, y: 520, w: 500, h: 180, angle: 3, cols: 7, rows: 2 },
  { x: 650, y: 1550, w: 380, h: 280, angle: 0, cols: 4, rows: 3 },
  { x: 2080, y: 1450, w: 300, h: 360, angle: 12, cols: 3, rows: 4 },
  { x: 1950, y: 900, w: 300, h: 220, angle: -5, cols: 4, rows: 3 },
];
function distToSeg(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy));
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
const distToLine = (p: Pt, pts: readonly Pt[]): number => Math.min(...pts.slice(1).map((b, i) => distToSeg(p, pts[i], b)));
/** Keeps buildings off roads, the rail line and the river. */
const clearOfLines = (p: Pt): boolean =>
  ROADS.every((r) => distToLine(p, r.pts) > r.w / 2 + 30) && distToLine(p, RAIL) > 30 && distToLine(p, RIVER) > 80;

function makeBuildings(): Building[] {
  const r = rng(1507);
  const out: Building[] = [];
  for (const c of CLUSTERS) {
    const a = (c.angle * Math.PI) / 180;
    const cw = c.w / c.cols, ch = c.h / c.rows;
    for (let i = 0; i < c.cols; i++) for (let j = 0; j < c.rows; j++) {
      if (r() < 0.1) continue;
      const lx = -c.w / 2 + cw * (i + 0.5) + (r() - 0.5) * cw * 0.2;
      const ly = -c.h / 2 + ch * (j + 0.5) + (r() - 0.5) * ch * 0.2;
      const x = c.x + lx * Math.cos(a) - ly * Math.sin(a);
      const y = c.y + lx * Math.sin(a) + ly * Math.cos(a);
      if (!clearOfLines({ x, y })) continue;
      out.push({
        x,
        y,
        w: cw * (0.55 + r() * 0.3),
        h: ch * (0.5 + r() * 0.35),
        angle: c.angle + (r() - 0.5) * 4,
        height: 14 + r() * 34,
      });
    }
  }
  return out;
}
export const BUILDINGS: readonly Building[] = makeBuildings();

/** Irregular closed outline around a centre, seeded. */
function blob(cx: number, cy: number, radius: number, seed: number, n = 7): Pt[] {
  const r = rng(seed);
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + (r() - 0.5) * 0.4;
    const rr = radius * (0.75 + r() * 0.45);
    return { x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr };
  });
}
export const QUEST_ZONES: ReadonlyArray<{ id: string; name: string; pts: readonly Pt[]; drawAt: number }> = [
  { id: "q1", name: "Supply Run", pts: blob(1650, 1320, 70, 11), drawAt: 510 },
  { id: "q2", name: "Signal Lost", pts: blob(1150, 900, 60, 12), drawAt: 516 },
];
export const PIN = { ...fromBearing(ME, 80, 40), label: "Marked 14:32", dropAt: 546 } as const;

/** NOMAD's freehand loop round zone q1 with a tail, seeded wobble. */
function makeStroke(): Pt[] {
  const r = rng(99);
  const pts: Pt[] = [];
  for (let i = 0; i <= 48; i++) {
    const a = -Math.PI * 0.6 + (i / 48) * Math.PI * 2.15;
    const rr = 118 + Math.sin(i * 0.7) * 6 + (r() - 0.5) * 5;
    pts.push({ x: 1650 + Math.cos(a) * rr, y: 1320 + Math.sin(a) * rr * 0.86 });
  }
  const last = pts[pts.length - 1];
  for (let i = 1; i <= 8; i++) pts.push({ x: last.x - i * 14, y: last.y - i * 11 + (r() - 0.5) * 3 });
  return pts;
}
export const STROKE = { pts: makeStroke(), color: C.nomad, drawFrom: 570, drawTo: 595 } as const;

/** The sonar reveal: a ring from me that uncovers the map. */
export const REVEAL = { from: 120, to: 216, radius: 2100 } as const;
export function revealRadius(frame: number): number {
  if (frame < REVEAL.from) return 0;
  return REVEAL.radius * easeOutCubic(clamp((frame - REVEAL.from) / (REVEAL.to - REVEAL.from)));
}
/** First frame at which the reveal covers `p`. */
export function revealFrame(p: Pt): number {
  const d = Math.hypot(p.x - ME.x, p.y - ME.y);
  for (let f = REVEAL.from; f <= REVEAL.to; f++) if (revealRadius(f) >= d) return f;
  return REVEAL.to;
}

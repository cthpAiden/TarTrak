import { memo, useId, type CSSProperties, type ReactNode } from "react";
import { Img, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { evolvePath } from "@remotion/paths";
import { C, SPRING_POP, SPRING_SOFT } from "../theme.ts";
import { COND, MONO, SANS } from "../fonts.ts";
import { bezier, clamp, easeInCubic, easeInOutCubic, easeOutCubic, lerp, prog } from "../lib/ease.ts";
import { hash01, rng } from "../lib/random.ts";
import { PERSPECTIVE, planeTransform, project3d, type Cam } from "./camera.ts";
import {
  AREAS, BUILDINGS, EXTRACTS, ME, MATES, PIN, QUEST_ZONES, RAIL, REVEAL, RIVER, ROADS, ROUTE_TARGET, STROKE, WORLD_H, WORLD_W,
  extractColor, fromBearing, mateLabel, revealFrame, revealRadius, type Building, type Mate, type Pt,
} from "./data.ts";
import { CONTOUR_LEVELS, SUN, contourLines, heightAt, toneGrid } from "./terrain.ts";
import { convexHull, extendEnds, offsetLine, sampleSmooth, smoothPath, stations } from "./geom.ts";
import { markerScale, measurePills, measureText } from "./pills.ts";

/** Which layers to draw (all default true except measures). `labels` = area names and grid numbers; me and my heading line always draw. */
export type WorldShow = Partial<{ grid: boolean; labels: boolean; extracts: boolean; mates: boolean; measures: boolean; route: boolean; quests: boolean; pin: boolean; stroke: boolean }>;
export type WorldProps = {
  cam: Cam;
  width: number;
  height: number;
  show?: WorldShow;
  /** Building height multiplier 0..1 (0 = flat roofs, used for the app window and minimap). Default 1. */
  extrude?: number;
};
const SHOW_DEFAULT = { grid: true, labels: true, extracts: true, mates: true, measures: false, route: true, quests: true, pin: true, stroke: true };

// ---------------------------------------------------------------------------------------------
// Colour helpers (alpha variants and mixes of theme colours only)

const rgbOf = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const rgba = (hex: string, a: number) => `rgba(${rgbOf(hex).join(", ")}, ${a})`;
/** Blend of two "#rrggbb" colours, as "#rrggbb" (so mixes can be mixed again). */
const mix = (a: string, b: string, t: number) => {
  const A = rgbOf(a), B = rgbOf(b);
  return `#${A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join("")}`;
};

// ---------------------------------------------------------------------------------------------
// Static geometry, computed once

/** Decorative ground round the 3000 x 2000 world, so tilted views never show a hard map edge. */
const MARGIN = 1000;
const EXT = { x: -MARGIN, y: -MARGIN, w: WORLD_W + 2 * MARGIN, h: WORLD_H + 2 * MARGIN };
const onMap = (p: Pt) => p.x > 0 && p.x < WORLD_W && p.y > 0 && p.y < WORLD_H;
/** Lines that run off the map keep going into the margin. */
const runOff = (pts: readonly Pt[]): Pt[] => {
  const e = extendEnds(pts, MARGIN);
  return [...(onMap(pts[0]) ? [] : [e[0]]), ...pts, ...(onMap(pts[pts.length - 1]) ? [] : [e[e.length - 1]])];
};

const CONTOUR_CELL = 20;
const CONTOURS: ReadonlyArray<{ d: string; major: boolean }> = (() => {
  const cols = EXT.w / CONTOUR_CELL, rows = EXT.h / CONTOUR_CELL;
  const grid = new Float64Array((cols + 1) * (rows + 1));
  for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) grid[j * (cols + 1) + i] = heightAt(EXT.x + i * CONTOUR_CELL, EXT.y + j * CONTOUR_CELL);
  const field = (x: number, y: number) => grid[Math.round(y / CONTOUR_CELL) * (cols + 1) + Math.round(x / CONTOUR_CELL)];
  return CONTOUR_LEVELS.map((level, i) => {
    const d = contourLines(level, CONTOUR_CELL, EXT.w, EXT.h, field)
      .map(({ pts, closed }) => {
        const kept: Pt[] = [];
        for (const p of pts) {
          const q = { x: p.x + EXT.x, y: p.y + EXT.y };
          const last = kept[kept.length - 1];
          if (!last || Math.hypot(q.x - last.x, q.y - last.y) > 4) kept.push(q);
        }
        return kept.length > 1 ? smoothPath(kept, closed && kept.length > 2) : "";
      })
      .join("");
    return { d, major: i % 4 === 0 };
  });
})();

const RIVER_D = smoothPath(runOff(RIVER));
const ROAD_DS = ROADS.map((r) => ({ w: r.w, d: smoothPath(runOff(r.pts)) }));
const RAIL_LINE = sampleSmooth(runOff(RAIL), false, 24);
const polyD = (pts: readonly Pt[]) => pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join("");
const RAIL_DS = [polyD(offsetLine(RAIL_LINE, 4)), polyD(offsetLine(RAIL_LINE, -4))];
const TIES_D = stations(RAIL_LINE, 20)
  .map((s) => `M${(s.x - s.nx * 7).toFixed(1)} ${(s.y - s.ny * 7).toFixed(1)}L${(s.x + s.nx * 7).toFixed(1)} ${(s.y + s.ny * 7).toFixed(1)}`)
  .join("");

const GRID_STEP = 200; // 100 m
const GRID_D = (() => {
  let d = "";
  for (let x = 0; x <= WORLD_W; x += GRID_STEP) d += `M${x} 0V${WORLD_H}`;
  for (let y = 0; y <= WORLD_H; y += GRID_STEP) d += `M0 ${y}H${WORLD_W}`;
  return d;
})();
/** A map-sheet frame round the world: border, ticks every 50 m (long every 100 m) pointing out. */
const FRAME_D = `M0 0H${WORLD_W}V${WORLD_H}H0Z`;
const TICKS_D = (() => {
  let d = "";
  for (let x = 0; x <= WORLD_W; x += GRID_STEP / 2) {
    const l = x % GRID_STEP === 0 ? 18 : 9;
    d += `M${x} ${-l}V0M${x} ${WORLD_H}V${WORLD_H + l}`;
  }
  for (let y = 0; y <= WORLD_H; y += GRID_STEP / 2) {
    const l = y % GRID_STEP === 0 ? 18 : 9;
    d += `M${-l} ${y}H0M${WORLD_W} ${y}H${WORLD_W + l}`;
  }
  return d;
})();
const RAIL_BED_D = polyD(RAIL_LINE);
const ROAD_CORE = mix(C.road, C.ground, 0.22);

/** Buildings share the terrain's sun (terrain.ts): shadows fall away from it. */
const SHADOW_DIR = { x: -Math.sin((SUN.az * Math.PI) / 180), y: Math.cos((SUN.az * Math.PI) / 180) };
const SHADOW_LEN = 1 / Math.tan((SUN.el * Math.PI) / 180);

type BuildingLook = Building & {
  corners: Pt[];
  rf: number;
  roof: string;
  walls: Array<{ len: number; cx: number; cy: number; phi: number; color: string; top: string }>;
};
const WALL_DARK = mix(C.wall, C.deep, 0.4);
const WALL_LIT = mix(C.wall, C.contourMajor, 0.72);
const LOOKS: readonly BuildingLook[] = BUILDINGS.map((b, i) => {
  const a = (b.angle * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a);
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => {
    const lx = (sx * b.w) / 2, ly = (sy * b.h) / 2;
    return { x: b.x + lx * ca - ly * sa, y: b.y + lx * sa + ly * ca };
  });
  const walls = [
    { len: b.w, cx: 0, cy: b.h / 2, phi: 0 },
    { len: b.w, cx: 0, cy: -b.h / 2, phi: 180 },
    { len: b.h, cx: -b.w / 2, cy: 0, phi: 90 },
    { len: b.h, cx: b.w / 2, cy: 0, phi: -90 },
  ].map((w) => {
    const facing = 180 + w.phi + b.angle;
    const lit = (Math.cos(((facing - SUN.az) * Math.PI) / 180) + 1) / 2;
    return { ...w, color: mix(WALL_DARK, WALL_LIT, lit), top: mix(WALL_DARK, WALL_LIT, Math.min(1, lit + 0.18)) };
  });
  const tone = hash01(31, i);
  const base = mix(C.roof, C.contourMajor, 0.28);
  const roof = tone < 0.5 ? mix(base, C.wall, 0.4 * (0.5 - tone)) : mix(base, C.contourMajor, 0.5 * (tone - 0.5));
  return { ...b, corners, rf: revealFrame(b), roof, walls };
});

const QUEST_DS = QUEST_ZONES.map((q) => ({ ...q, d: smoothPath(q.pts, true) }));
const STROKE_D = smoothPath(STROKE.pts);
const ROUTE_TO = EXTRACTS.find((e) => e.id === ROUTE_TARGET)!;

// ---------------------------------------------------------------------------------------------
// Ground texture: hillshade + altitude tint + soft mottling + dither, painted once per page.

/** Smooth seeded value noise in [0, 1) with lattice spacing `cell`, over the extended ground. */
function valueNoise(seed: number, cell: number): (x: number, y: number) => number {
  const cols = Math.ceil(EXT.w / cell) + 2, rows = Math.ceil(EXT.h / cell) + 2;
  const r = rng(seed);
  const lattice = Float32Array.from({ length: cols * rows }, () => r());
  return (x, y) => {
    const u = (x - EXT.x) / cell, v = (y - EXT.y) / cell;
    const i = Math.floor(u), j = Math.floor(v);
    const fx = u - i, fy = v - j;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const at = (a: number, b: number) => lattice[b * cols + a];
    return lerp(lerp(at(i, j), at(i + 1, j), sx), lerp(at(i, j + 1), at(i + 1, j + 1), sx), sy);
  };
}

const TEX_STEP = 8;
let groundUrl: string | null = null;
function groundTexture(): string {
  if (groundUrl) return groundUrl;
  const cols = EXT.w / TEX_STEP, rows = EXT.h / TEX_STEP;
  const tones = toneGrid(EXT.x + TEX_STEP / 2, EXT.y + TEX_STEP / 2, TEX_STEP, cols, rows);
  const broad = valueNoise(41, 260), fine = valueNoise(42, 90);
  const canvas = document.createElement("canvas");
  canvas.width = cols;
  canvas.height = rows;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(cols, rows);
  const [r, g, b] = rgbOf(C.ground);
  const rand = rng(2026);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const k = j * cols + i;
    const x = EXT.x + (i + 0.5) * TEX_STEP, y = EXT.y + (j + 0.5) * TEX_STEP;
    const mottle = 0.07 * (broad(x, y) - 0.5) + 0.04 * (fine(x, y) - 0.5);
    const t = tones[k] + mottle, n = rand() - 0.5, shade = tones[k] - 1;
    // warm light on lit slopes, cool shade on the far side
    img.data[k * 4] = r * t + 16 * shade + n;
    img.data[k * 4 + 1] = g * t + 9 * shade + 15 * mottle + n;
    img.data[k * 4 + 2] = b * t - 5 * shade + n;
    img.data[k * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  groundUrl = canvas.toDataURL("image/jpeg", 0.92);
  return groundUrl;
}

// ---------------------------------------------------------------------------------------------
// Static map layer (memoised). Line widths follow CSS variables set per frame on the parent:
// --k = 1 / sqrt(zoom) (map lines thin out gently as the camera closes in), --p = 1 / zoom (1 screen px).

const sw = (expr: string): CSSProperties => ({ strokeWidth: expr });

const StaticMap = memo(function StaticMap({ uid, grid, labels }: { uid: string; grid: boolean; labels: boolean }) {
  return (
    <g>
      <rect x={EXT.x} y={EXT.y} width={EXT.w} height={EXT.h} fill={`url(#${uid}-grain-l)`} />
      <rect x={EXT.x} y={EXT.y} width={EXT.w} height={EXT.h} fill={`url(#${uid}-grain-d)`} />
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        {CONTOURS.filter((c) => !c.major).map((c, i) => (
          <path key={`c${i}`} d={c.d} stroke={C.contour} strokeOpacity={0.8} style={sw("calc(var(--k) * 1.2px)")} />
        ))}
        {CONTOURS.filter((c) => c.major).map((c, i) => (
          <path key={`m${i}`} d={c.d} stroke={C.contourMajor} strokeOpacity={0.8} style={sw("calc(var(--k) * 2px)")} />
        ))}
      </g>
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d={RIVER_D} stroke={C.waterEdge} style={sw("calc(70px + var(--k) * 6px)")} />
        <path d={RIVER_D} stroke={C.water} strokeWidth={70} />
        <path d={RIVER_D} stroke={C.waterEdge} strokeOpacity={0.55} strokeDasharray="36 60" style={sw("calc(var(--k) * 1.2px)")} />
      </g>
      <g fill="none" stroke={C.rail}>
        <path d={RAIL_BED_D} stroke={C.roadEdge} strokeOpacity={0.85} strokeWidth={17} />
        <path d={TIES_D} strokeOpacity={0.5} style={sw("calc(var(--k) * 1.8px)")} />
        {RAIL_DS.map((d, i) => (
          <path key={i} d={d} style={sw("calc(var(--k) * 1.6px)")} />
        ))}
      </g>
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        {ROAD_DS.map((r, i) => (
          <path key={`e${i}`} d={r.d} stroke={C.roadEdge} style={sw(`calc(${r.w}px + var(--k) * 6px)`)} />
        ))}
        {ROAD_DS.map((r, i) => (
          <path key={`r${i}`} d={r.d} stroke={ROAD_CORE} strokeWidth={r.w} />
        ))}
        {ROAD_DS.slice(0, 2).map((r, i) => (
          <path key={`d${i}`} d={r.d} stroke={rgba(C.fg, 0.32)} strokeDasharray="16 20" strokeLinecap="butt" style={sw("calc(var(--k) * 1.4px)")} />
        ))}
      </g>
      <rect x={EXT.x} y={EXT.y} width={EXT.w} height={EXT.h} fill={`url(#${uid}-pool)`} />
      {grid && (
        <g fill="none" stroke="#ffffff">
          <path d={GRID_D} strokeOpacity={0.04} style={sw("calc(var(--p) * 1px)")} />
          <path d={FRAME_D} strokeOpacity={0.14} style={sw("calc(var(--k) * 1.5px)")} />
          <path d={TICKS_D} strokeOpacity={0.28} style={sw("calc(var(--k) * 1.5px)")} />
        </g>
      )}
      {grid && labels && (
        <g fill="#ffffff" fillOpacity={0.32} fontFamily={MONO} fontSize={15} letterSpacing={1}>
          {Array.from({ length: WORLD_W / GRID_STEP + 1 }, (_, i) => (
            <text key={`t${i}`} x={i * GRID_STEP} y={-28} textAnchor="middle">{i * 100}</text>
          ))}
          {Array.from({ length: WORLD_W / GRID_STEP + 1 }, (_, i) => (
            <text key={`b${i}`} x={i * GRID_STEP} y={WORLD_H + 42} textAnchor="middle">{i * 100}</text>
          ))}
          {Array.from({ length: WORLD_H / GRID_STEP + 1 }, (_, i) => (
            <text key={`l${i}`} x={-28} y={i * GRID_STEP + 5} textAnchor="end">{i * 100}</text>
          ))}
          {Array.from({ length: WORLD_H / GRID_STEP + 1 }, (_, i) => (
            <text key={`r${i}`} x={WORLD_W + 28} y={i * GRID_STEP + 5}>{i * 100}</text>
          ))}
        </g>
      )}
      <rect x={EXT.x} y={EXT.y} width={EXT.w} height={EXT.h} fill={`url(#${uid}-edge)`} />
    </g>
  );
});

/** Defs that never change: grain tiles and the fade into the dark round the map. */
const StaticDefs = memo(function StaticDefs({ uid }: { uid: string }) {
  const grain = (id: string, matrix: string, opacity: number) => (
    <>
      <filter id={`${uid}-${id}-f`} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves={2} seed={7} stitchTiles="stitch" />
        <feColorMatrix type="matrix" values={matrix} />
      </filter>
      <pattern id={`${uid}-${id}`} width={64} height={64} patternUnits="userSpaceOnUse">
        <rect width={64} height={64} filter={`url(#${uid}-${id}-f)`} opacity={opacity} />
      </pattern>
    </>
  );
  const cx = WORLD_W / 2, cy = WORLD_H / 2, ry = 1950 / 2450;
  return (
    <>
      {grain("grain-l", "0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  4 0 0 0 -2", 0.05)}
      {grain("grain-d", "0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -4 0 0 0 2", 0.07)}
      <radialGradient id={`${uid}-edge`} gradientUnits="userSpaceOnUse" cx={cx} cy={cy} r={2450} gradientTransform={`translate(${cx} ${cy}) scale(1 ${ry}) translate(${-cx} ${-cy})`}>
        <stop offset={0.72} stopColor={C.groundDeep} stopOpacity={0} />
        <stop offset={0.86} stopColor={C.groundDeep} stopOpacity={0.6} />
        <stop offset={1} stopColor={C.groundDeep} stopOpacity={1} />
      </radialGradient>
      {/* the map is lit round the player and falls off with distance */}
      <radialGradient id={`${uid}-pool`} gradientUnits="userSpaceOnUse" cx={ME.x} cy={ME.y} r={1900}>
        <stop offset={0.2} stopColor={C.groundDeep} stopOpacity={0} />
        <stop offset={1} stopColor={C.groundDeep} stopOpacity={0.4} />
      </radialGradient>
    </>
  );
});

// ---------------------------------------------------------------------------------------------
// Buildings: CSS 3D boxes in the plane.

/** Floor lines every 3.5 m, drawn from the roof down. */
const FLOORS = `repeating-linear-gradient(to bottom, transparent 0px, transparent 6px, ${rgba(C.deep, 0.14)} 6px, ${rgba(C.deep, 0.14)} 7px)`;

const BuildingBox = ({ b, H, zoom, vis }: { b: BuildingLook; H: number; zoom: number; vis: number }) => {
  const edge = Math.max(0.4, 1 / zoom);
  return (
    <div style={{ position: "absolute", left: 0, top: 0, transformStyle: "preserve-3d", transform: `translate3d(${b.x}px, ${b.y}px, 0px) rotateZ(${b.angle}deg)` }}>
      {H > 0.5 &&
        b.walls.map((w, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: -w.len / 2,
              top: -H,
              width: w.len,
              height: H,
              transformOrigin: "50% 100%",
              transform: `translate3d(${w.cx}px, ${w.cy}px, 0px) rotateZ(${w.phi}deg) rotateX(-90deg)`,
              backfaceVisibility: "hidden",
              opacity: vis,
              background: `${FLOORS}, linear-gradient(to bottom, ${w.top}, ${w.color} 40%, ${mix(w.color, C.deep, 0.4)})`,
            }}
          />
        ))}
      <div
        style={{
          position: "absolute",
          left: -b.w / 2,
          top: -b.h / 2,
          width: b.w,
          height: b.h,
          transform: `translateZ(${Math.max(H, 0.6)}px)`,
          opacity: vis,
          background: b.roof,
          boxShadow: `inset 0 0 0 ${edge}px ${mix(b.roof, C.fg2, 0.25)}, inset 0 0 0 ${edge + 2.5}px ${rgba(C.deep, 0.22)}`,
        }}
      />
    </div>
  );
};

// ---------------------------------------------------------------------------------------------
// Overlay pieces (screen space)

const pillStyle: CSSProperties = {
  position: "absolute",
  whiteSpace: "nowrap",
  padding: "3px 8px",
  borderRadius: 4,
  background: rgba(C.deep, 0.74),
  border: `1px solid ${rgba(C.fg, 0.08)}`,
  color: C.fg,
  font: `500 13px ${MONO}`,
  letterSpacing: "0.06em",
  lineHeight: "16px",
  fontVariantNumeric: "tabular-nums",
};

/** A pill whose text types in over progress p: nothing before the first character, a thin caret while typing. */
const TypedPill = ({ text, p, style, caret = C.amber }: { text: string; p: number; style?: CSSProperties; caret?: string }) => {
  const n = Math.round(text.length * clamp(p));
  if (n <= 0) return null;
  return (
    <div style={{ ...pillStyle, ...style }}>
      {text.slice(0, n)}
      {n < text.length && <span style={{ display: "inline-block", width: 2, height: 13, marginLeft: 2, verticalAlign: "-2px", background: caret }} />}
    </div>
  );
};

const ExitGlyph = () => (
  <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke={C.deep} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.5 2.5H3.5v11h6" />
    <path d="M7 8h7M11 5l3 3-3 3" />
  </svg>
);

const PinGlyph = () => (
  <svg width={34} height={45} viewBox="0 0 24 32">
    <path d="M12 31C12 31 2 19 2 11a10 10 0 0 1 20 0c0 8-10 20-10 20z" fill={C.amber} stroke={C.onAmber} strokeWidth={1.5} />
    <circle cx={12} cy={11} r={4} fill="none" stroke="#ffffff" strokeWidth={2} />
  </svg>
);

type Proj = { x: number; y: number; s: number };
const inView = (p: Proj, w: number, h: number, pad = 240) => p.s > 0.05 && p.s < 6 && p.x > -pad && p.x < w + pad && p.y > -pad && p.y < h + pad;

/** A screen-space anchor: children are laid out round (0, 0) and scaled by the perspective at that point (pills.ts lays out with the same scale). */
const At = ({ p, children, style }: { p: Proj; children: ReactNode; style?: CSSProperties }) => (
  <div style={{ position: "absolute", left: 0, top: 0, transform: `translate(${p.x}px, ${p.y}px) scale(${markerScale(p.s)})`, ...style }}>{children}</div>
);

// ---------------------------------------------------------------------------------------------

/** The made-up map and everything on it, as a function of the global frame, seen through `cam`. */
export const World = ({ cam, width, height, show, extrude = 1 }: WorldProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const uid = `w${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const on = { ...SHOW_DEFAULT, ...show };
  const outer: CSSProperties = { position: "relative", width, height, overflow: "hidden", background: C.groundDeep };
  if (frame < REVEAL.from) return <div style={outer} />;

  const z = cam.zoom;
  const P = (p: Pt, h = 0) => project3d(cam, p, h, width, height);
  const R = revealRadius(frame);
  const revealT = prog(frame, REVEAL.from, REVEAL.to);
  const px = (n: number) => n / z;
  /** Widths the brief gives in world units grow only with sqrt(zoom): readable when far, not bloated when close. */
  const semi = 1 / Math.sqrt(z);
  const springAt = (f0: number, config: { damping: number; stiffness: number; mass: number } = SPRING_POP, durationInFrames?: number) =>
    frame - f0 > 90 ? 1 : spring({ frame: frame - f0, fps, config, durationInFrames });

  // Heading lines ---------------------------------------------------------------------------
  const heading = (key: string, from: Pt, bearing: number, len: number, color: string, w: number) => {
    if (len <= 0.5) return null;
    const end = fromBearing(from, bearing, len / 2);
    const far = fromBearing(from, bearing, 60);
    return (
      <g key={key}>
        <defs>
          <linearGradient id={`${uid}-hd-${key}`} gradientUnits="userSpaceOnUse" x1={from.x} y1={from.y} x2={far.x} y2={far.y}>
            <stop offset={0} stopColor={color} stopOpacity={1} />
            <stop offset={1} stopColor={color} stopOpacity={0.15} />
          </linearGradient>
        </defs>
        <line x1={from.x} y1={from.y} x2={end.x} y2={end.y} stroke={`url(#${uid}-hd-${key})`} strokeWidth={w * semi} strokeDasharray={`${10 * semi} ${14 * semi}`} strokeLinecap="round" />
      </g>
    );
  };
  const myHeadingLen = 120 * easeOutCubic(prog(frame, 132, 150));
  const mates = on.mates ? MATES.filter((m) => frame >= m.landAt - 20) : [];
  const mateSwing = (m: Mate) => springAt(m.landAt, SPRING_POP, 12);

  // Mate drop heights ---------------------------------------------------------------------------
  const dropZ = (m: Mate, f: number) => (f >= m.landAt ? 0 : 600 * (1 - easeInCubic(prog(f, m.landAt - 20, m.landAt))));

  // Pin drop ------------------------------------------------------------------------------------
  const pinLand = PIN.dropAt + 6;
  const pinZ = (f: number) =>
    f < pinLand ? 220 * (1 - easeInCubic(prog(f, PIN.dropAt, pinLand))) : 26 * Math.max(0, 4 * prog(f, pinLand, pinLand + 12) * (1 - prog(f, pinLand, pinLand + 12)));

  // Buildings -----------------------------------------------------------------------------------
  const buildings = LOOKS.filter((b) => frame >= b.rf).map((b) => ({
    b,
    H: b.height * springAt(b.rf, SPRING_SOFT) * extrude,
    // fade in with the soft edge of the reveal, like the ground under it
    vis: clamp((R - Math.hypot(b.x - ME.x, b.y - ME.y) + 30) / 70),
  }));

  const vars = { "--k": 1 / Math.sqrt(z), "--p": 1 / z } as CSSProperties;

  const svg = (
    <svg
      width={EXT.w}
      height={EXT.h}
      viewBox={`${EXT.x} ${EXT.y} ${EXT.w} ${EXT.h}`}
      style={{ position: "absolute", left: EXT.x, top: EXT.y, overflow: "visible", transform: "translateZ(0.5px)" }}
    >
      <defs>
        <StaticDefs uid={uid} />
        <radialGradient id={`${uid}-reveal`} gradientUnits="userSpaceOnUse" cx={ME.x} cy={ME.y} r={Math.max(R, 1)}>
          <stop offset={clamp((R - 60) / Math.max(R, 1))} stopColor={C.groundDeep} stopOpacity={0} />
          <stop offset={1} stopColor={C.groundDeep} stopOpacity={1} />
        </radialGradient>
        <radialGradient id={`${uid}-wake`} gradientUnits="userSpaceOnUse" cx={ME.x} cy={ME.y} r={Math.max(R, 1)}>
          <stop offset={clamp((R - Math.min(260, 0.3 * R)) / Math.max(R, 1))} stopColor={C.amber} stopOpacity={0} />
          <stop offset={clamp((R - 8) / Math.max(R, 1))} stopColor={C.amber} stopOpacity={0.12 * (1 - revealT)} />
          <stop offset={1} stopColor={C.amber} stopOpacity={0} />
        </radialGradient>
      </defs>
      <g style={vars}>
        <StaticMap uid={uid} grid={on.grid} labels={on.labels} />
      </g>

      {/* building footprints: contact shadow always, cast shadow as they rise */}
      <g fill={C.deep}>
        {buildings.map(({ b, H, vis }, i) => {
          const v = { x: SHADOW_DIR.x * H * SHADOW_LEN, y: SHADOW_DIR.y * H * SHADOW_LEN };
          const hull = H > 0.3 ? convexHull([...b.corners, ...b.corners.map((c) => ({ x: c.x + v.x, y: c.y + v.y }))]) : null;
          return (
            <g key={i} opacity={vis}>
              <polygon points={b.corners.map((c) => `${c.x},${c.y}`).join(" ")} fillOpacity={0.35} stroke={C.deep} strokeOpacity={0.35} strokeWidth={px(3)} />
              {hull && <polygon points={hull.map((c) => `${c.x},${c.y}`).join(" ")} fillOpacity={0.3} />}
            </g>
          );
        })}
      </g>

      {/* the reveal: dark outside the sonar ring, a warm wake behind its edge */}
      <rect x={EXT.x} y={EXT.y} width={EXT.w} height={EXT.h} fill={`url(#${uid}-reveal)`} />
      {revealT < 1 && (
        <g fill="none" stroke={C.amber}>
          <circle cx={ME.x} cy={ME.y} r={R} fill={`url(#${uid}-wake)`} stroke="none" />
          <circle cx={ME.x} cy={ME.y} r={R} strokeOpacity={0.15 * (1 - revealT)} strokeWidth={px(18)} />
          <circle cx={ME.x} cy={ME.y} r={R} strokeOpacity={0.3 * (1 - revealT)} strokeWidth={px(7)} />
          <circle cx={ME.x} cy={ME.y} r={R} strokeOpacity={0.9 * (1 - revealT)} strokeWidth={px(3)} />
        </g>
      )}
      {frame <= 160 && (
        <circle cx={ME.x} cy={ME.y} r={400 * easeOutCubic(prog(frame, 120, 160))} fill="none" stroke={C.amber} strokeWidth={px(2)} strokeOpacity={1 - prog(frame, 120, 160)} />
      )}

      {/* quest zones */}
      {on.quests &&
        QUEST_DS.filter((q) => frame >= q.drawAt).map((q) => {
          const p = easeInOutCubic(prog(frame, q.drawAt, q.drawAt + 15));
          const ev = evolvePath(p, q.d);
          return (
            <g key={q.id} fill="none" strokeLinejoin="round" strokeLinecap="round">
              <path d={q.d} fill="rgba(62, 207, 142, 0.14)" stroke="none" opacity={prog(frame, q.drawAt + 15, q.drawAt + 25)} />
              <path d={q.d} stroke={C.ok} strokeOpacity={0.22} strokeWidth={px(9)} strokeDasharray={ev.strokeDasharray} strokeDashoffset={ev.strokeDashoffset} />
              <path d={q.d} stroke={C.ok} strokeWidth={px(3)} strokeDasharray={ev.strokeDasharray} strokeDashoffset={ev.strokeDashoffset} />
            </g>
          );
        })}

      {/* measures */}
      {on.measures &&
        frame >= 300 &&
        MATES.map((m) => {
          const p = easeOutCubic(prog(frame, 300, 315));
          return (
            <line key={m.id} x1={ME.x} y1={ME.y} x2={lerp(ME.x, m.x, p)} y2={lerp(ME.y, m.y, p)} stroke={m.color} strokeOpacity={0.7} strokeWidth={px(2)} strokeDasharray={`${px(6)} ${px(6)}`} />
          );
        })}

      {/* heading lines: mine draws out, teammates' swing into place after landing */}
      {heading("me", ME, ME.heading, myHeadingLen, C.amber, 6)}
      {mates
        .filter((m) => frame >= m.landAt)
        .map((m) => {
          const s = mateSwing(m);
          return heading(m.id, m, m.heading - 80 * (1 - s), 120 * clamp(s * 1.4), m.color, 4.5);
        })}

      {/* route (above the heading lines: it is the hero of its cut) */}
      {on.route && frame >= 480 && (() => {
        const p = easeOutCubic(prog(frame, 480, 498));
        const x2 = lerp(ME.x, ROUTE_TO.x, p), y2 = lerp(ME.y, ROUTE_TO.y, p);
        return (
          <g strokeLinecap="round">
            <line x1={ME.x} y1={ME.y} x2={x2} y2={y2} stroke={C.amber} strokeOpacity={0.2} strokeWidth={14 * semi} />
            <line x1={ME.x} y1={ME.y} x2={x2} y2={y2} stroke={C.amber} strokeWidth={5 * semi} strokeDasharray={`${14 * semi} ${12 * semi}`} strokeDashoffset={-frame * 2 * semi} />
          </g>
        );
      })()}

      {/* landing rings */}
      {mates
        .filter((m) => frame >= m.landAt && frame <= m.landAt + 24)
        .map((m) => {
          const u = prog(frame, m.landAt, m.landAt + 18), u2 = prog(frame, m.landAt + 4, m.landAt + 24);
          return (
            <g key={m.id} fill="none" stroke={m.color}>
              <circle cx={m.x} cy={m.y} r={60 * easeOutCubic(u)} strokeWidth={px(2.5)} strokeOpacity={1 - u} />
              <circle cx={m.x} cy={m.y} r={38 * easeOutCubic(u2)} strokeWidth={px(1.5)} strokeOpacity={0.7 * (1 - u2)} />
            </g>
          );
        })}
      {on.pin && frame >= pinLand && frame <= pinLand + 20 && (
        <circle cx={PIN.x} cy={PIN.y} r={36 * easeOutCubic(prog(frame, pinLand, pinLand + 16))} fill="none" stroke={C.amber} strokeWidth={px(2)} strokeOpacity={1 - prog(frame, pinLand, pinLand + 16)} />
      )}

      {/* NOMAD's freehand stroke */}
      {on.stroke && frame >= STROKE.drawFrom && (() => {
        const p = bezier(0.3, 0, 0.6, 1)(prog(frame, STROKE.drawFrom, STROKE.drawTo));
        if (p <= 0) return null;
        const ev = evolvePath(p, STROKE_D);
        return (
          <g fill="none" stroke={STROKE.color} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={ev.strokeDasharray} strokeDashoffset={ev.strokeDashoffset}>
            <path d={STROKE_D} strokeOpacity={0.28} strokeWidth={px(16)} />
            <path d={STROKE_D} strokeWidth={px(6)} />
          </g>
        );
      })()}
    </svg>
  );

  // Overlay (screen space) --------------------------------------------------------------------
  const overlaySvg: ReactNode[] = [];
  const nodes: ReactNode[] = [];

  if (on.labels) {
    for (const a of AREAS) {
      const rf = revealFrame(a);
      if (frame < rf) continue;
      // floats above the rooftops while the buildings stand, with a thin leader down to the ground
      const lift = 70 * extrude;
      const p = P(a, lift);
      if (!inView(p, width, height)) continue;
      const o = prog(frame, rf + 4, rf + 18, easeOutCubic);
      if (lift > 1) {
        const g = P(a);
        const k = clamp(p.s, 0.45, 1.35);
        overlaySvg.push(
          <g key={`al-${a.name}`} opacity={o * clamp(extrude * 2)}>
            <line x1={g.x} y1={g.y} x2={p.x} y2={p.y + 12 * k} stroke={C.fg2} strokeOpacity={0.35} strokeWidth={1} />
            <circle cx={g.x} cy={g.y} r={2.2 * k} fill={C.fg2} fillOpacity={0.6} />
          </g>,
        );
      }
      nodes.push(
        <At key={`a-${a.name}`} p={p} style={{ opacity: o }}>
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              transform: `translate(-50%, -50%) translateY(${(1 - o) * 8}px)`,
              font: `600 15px ${COND}`,
              letterSpacing: "0.2em",
              color: rgba(C.fg2, 0.78),
              whiteSpace: "nowrap",
              textShadow: `0 0 6px ${rgba(C.deep, 0.9)}, 0 1px 2px ${rgba(C.deep, 0.9)}`,
            }}
          >
            {a.name}
          </div>
        </At>,
      );
    }
  }

  if (on.extracts) {
    for (const e of EXTRACTS) {
      if (frame < e.popAt) continue;
      const p = P(e);
      if (!inView(p, width, height)) continue;
      const pop = springAt(e.popAt);
      const color = extractColor(e.kind);
      const ring = prog(frame, e.popAt, e.popAt + 16);
      if (ring < 1) overlaySvg.push(<circle key={`er-${e.id}`} cx={p.x} cy={p.y} r={(13 + 30 * easeOutCubic(ring)) * p.s} fill="none" stroke={color} strokeWidth={2} strokeOpacity={0.9 * (1 - ring)} />);
      const isRoute = on.route && e.id === ROUTE_TARGET && frame >= 480;
      nodes.push(
        <At key={`e-${e.id}`} p={p}>
          <div
            style={{
              position: "absolute",
              left: -13,
              top: -13,
              width: 26,
              height: 26,
              borderRadius: 6,
              background: color,
              border: `1.5px solid ${C.deep}`,
              boxSizing: "border-box",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transform: `scale(${pop})`,
              boxShadow: `0 0 14px ${rgba(color, 0.45)}, 0 2px 6px ${rgba(C.deep, 0.6)}`,
            }}
          >
            <ExitGlyph />
          </div>
          <TypedPill text={e.name} p={prog(frame, e.popAt + 1, e.popAt + 11)} caret={color} style={{ left: 21, top: -12, textTransform: "uppercase" }} />
          {isRoute && (
            <div style={{ ...pillStyle, left: 0, top: -48, transform: `translateX(-50%) scale(${springAt(480)})`, color: C.amber, border: `1px solid ${rgba(C.amber, 0.7)}`, fontWeight: 600 }}>
              {`${Math.round(412 * easeOutCubic(prog(frame, 480, 498)))} m`}
            </div>
          )}
        </At>,
      );
    }
  }

  if (on.measures && frame >= 300) {
    // pills.ts keeps each pill on its line when there is room, else beside it, clear of dots, labels and each other
    const o = prog(frame, 304, 312);
    const count = easeOutCubic(prog(frame, 300, 330));
    for (const pill of measurePills(cam, width, height)) {
      const m = MATES.find((q) => q.id === pill.id)!;
      if (pill.fade <= 0 || !inView({ ...pill, s: pill.k }, width, height)) continue;
      nodes.push(
        <At key={`ms-${m.id}`} p={{ x: pill.x, y: pill.y, s: pill.k }}>
          <div style={{ ...pillStyle, left: 0, top: 0, transform: "translate(-50%, -50%)", font: `500 12px ${MONO}`, padding: "2px 7px", opacity: o * pill.fade, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: 3, background: m.color, display: "inline-block" }} />
            {measureText(Math.round(m.metres * count))}
          </div>
        </At>,
      );
    }
  }

  if (on.pin && frame >= PIN.dropAt) {
    const pz = pinZ(frame);
    const ground = P(PIN);
    const p = P(PIN, pz);
    if (inView(ground, width, height)) {
      const near = 1 - pz / 220;
      const squash = frame >= pinLand ? 0.82 + 0.18 * springAt(pinLand) : 1;
      nodes.push(
        <At key="pin-shadow" p={ground}>
          <div style={{ position: "absolute", left: -12, top: -5, width: 24, height: 10, borderRadius: "50%", background: rgba(C.deep, 0.55 * near), transform: `scale(${0.5 + 0.5 * near})`, filter: "blur(1.5px)" }} />
        </At>,
        <At key="pin" p={p}>
          <div style={{ position: "absolute", left: -17, top: -44, width: 34, height: 45, transformOrigin: "50% 100%", transform: `scaleY(${squash}) scaleX(${2 - squash})`, filter: `drop-shadow(0 0 8px ${rgba(C.amber, 0.45)})` }}>
            <PinGlyph />
          </div>
          <TypedPill text={PIN.label} p={prog(frame, pinLand + 1, pinLand + 7)} style={{ left: 22, top: -42 }} />
        </At>,
      );
    }
  }

  for (const m of mates) {
    const mz = dropZ(m, frame);
    const p = P(m, mz);
    if (!inView(p, width, height, 600)) continue;
    // comet trail: the heights of the previous 8 frames
    const trail: Proj[] = [];
    for (let k = 1; k <= 8; k++) {
      const f = frame - k;
      if (f < m.landAt - 20) break;
      trail.push(P(m, dropZ(m, f)));
    }
    const tail = trail[trail.length - 1];
    if (tail && Math.hypot(tail.x - p.x, tail.y - p.y) > 2) {
      const dx = tail.x - p.x, dy = tail.y - p.y, len = Math.hypot(dx, dy);
      const nx = -dy / len, ny = dx / len;
      const taper = (hw: number) => `${p.x + nx * hw},${p.y + ny * hw} ${p.x - nx * hw},${p.y - ny * hw} ${tail.x},${tail.y}`;
      // a light trail: soft glow round a hot, tapering core
      overlaySvg.push(
        <g key={`tr-${m.id}`}>
          <defs>
            <linearGradient id={`${uid}-tr-${m.id}`} gradientUnits="userSpaceOnUse" x1={p.x} y1={p.y} x2={tail.x} y2={tail.y}>
              <stop offset={0} stopColor={mix(m.color, "#ffffff", 0.55)} stopOpacity={1} />
              <stop offset={0.35} stopColor={m.color} stopOpacity={0.8} />
              <stop offset={1} stopColor={m.color} stopOpacity={0} />
            </linearGradient>
            <linearGradient id={`${uid}-trg-${m.id}`} gradientUnits="userSpaceOnUse" x1={p.x} y1={p.y} x2={tail.x} y2={tail.y}>
              <stop offset={0} stopColor={m.color} stopOpacity={0.35} />
              <stop offset={1} stopColor={m.color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <polygon points={taper(13 * p.s)} fill={`url(#${uid}-trg-${m.id})`} />
          <polygon points={taper(3.5 * p.s)} fill={`url(#${uid}-tr-${m.id})`} />
        </g>,
      );
    }
    trail.forEach((t, i) => {
      const k = (i + 1) / 8;
      overlaySvg.push(<circle key={`tc-${m.id}-${i}`} cx={t.x} cy={t.y} r={8 * t.s * lerp(0.9, 0.35, k)} fill={m.color} fillOpacity={lerp(0.5, 0.05, k)} />);
    });
    const landed = frame >= m.landAt;
    const squash = landed ? 0.7 + 0.3 * springAt(m.landAt) : 1;
    const flash = landed ? 1 - prog(frame, m.landAt, m.landAt + 8) : 0;
    const label = mateLabel(m);
    nodes.push(
      <At key={`m-${m.id}`} p={p}>
        {flash > 0 && <div style={{ position: "absolute", left: -18, top: -18, width: 36, height: 36, borderRadius: 18, background: `radial-gradient(circle, ${rgba("#ffffff", 0.9 * flash)}, ${rgba(m.color, 0.5 * flash)} 45%, transparent 70%)` }} />}
        <div
          style={{
            position: "absolute",
            left: -8,
            top: -8,
            width: 16,
            height: 16,
            borderRadius: 8,
            background: m.color,
            border: `2.5px solid ${C.deep}`,
            boxSizing: "content-box",
            margin: -2.5,
            transform: `scale(${2 - squash}, ${squash})`,
            transformOrigin: "50% 100%",
            boxShadow: `0 0 12px ${rgba(m.color, 0.55)}`,
          }}
        />
        <TypedPill text={label} p={prog(frame, m.landAt, m.landAt + 8)} caret={m.color} style={{ left: 0, top: -40, transform: "translateX(-50%)", font: `600 13px ${SANS}`, letterSpacing: "0.04em" }} />
      </At>,
    );
  }

  // me, always on top
  {
    const p = P(ME);
    const pop = 0.45 + 0.55 * springAt(REVEAL.from);
    nodes.push(
      <At key="me" p={p}>
        <div
          style={{
            position: "absolute",
            left: -12,
            top: -12,
            width: 18,
            height: 18,
            borderRadius: 12,
            background: C.amber,
            border: `3px solid ${C.onAmber}`,
            transform: `scale(${pop})`,
            boxShadow: `0 0 0 1px ${rgba(C.amber, 0.35)}, 0 0 22px 6px ${rgba(C.amber, 0.45)}`,
          }}
        />
      </At>,
    );
  }

  const fog = clamp(cam.tilt / 45);

  return (
    <div style={{ ...outer, perspective: `${PERSPECTIVE}px`, perspectiveOrigin: "50% 50%" }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: WORLD_W,
          height: WORLD_H,
          transformOrigin: "0 0",
          transform: planeTransform(cam, width, height),
          transformStyle: "preserve-3d",
        }}
      >
        <Img src={groundTexture()} style={{ position: "absolute", left: EXT.x, top: EXT.y, width: EXT.w, height: EXT.h, transform: "translateZ(0px)" }} />
        {svg}
        {buildings.map(({ b, H, vis }, i) => (
          <BuildingBox key={i} b={b} H={H} zoom={z} vis={vis} />
        ))}
      </div>
      {fog > 0 && (
        <div style={{ position: "absolute", inset: 0, background: `linear-gradient(to bottom, ${rgba(C.groundDeep, 0.92 * fog)} 0%, ${rgba(C.groundDeep, 0.5 * fog)} 18%, ${rgba(C.groundDeep, 0)} 45%)` }} />
      )}
      <svg width={width} height={height} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
        {overlaySvg}
      </svg>
      {nodes}
    </div>
  );
};

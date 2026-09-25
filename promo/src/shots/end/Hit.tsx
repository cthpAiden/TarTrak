import type { CSSProperties } from "react";
import { useCurrentFrame } from "remotion";
import { MONO } from "../../fonts.ts";
import { C } from "../../theme.ts";
import { clamp, easeInOutCubic, easeOutCubic, easeOutExpo, lerp, track, type Key } from "../../lib/ease.ts";
import { hash01 } from "../../lib/random.ts";
import { HANDOFF } from "../../timeline.ts";

/** The final hit: shot 6's last frame is 719. */
export const HIT = 720;
/** Shot 6 scales the app's bezel (disc r 165 + RING 26 = outer 191) so its outer edge lands on HANDOFF.logo.r. */
export const K = HANDOFF.logo.r / 191;
/** The collapsing ring: centre, outer radius, band width. */
export type Ring = { cx: number; cy: number; r: number; sw: number };

/** White heat of the 2-frame flash on the ring (a third frame cools it into amber). */
export const heatAt = (frame: number): number => [1, 0.55, 0.2][frame - HIT] ?? 0;

const rgbOf = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
/** `a` mixed towards `b` by `t` (hex in, rgb() out). */
export const mixHex = (a: string, b: string, t: number): string => {
  const A = rgbOf(a);
  const B = rgbOf(b);
  return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], clamp(t)))).join(", ")})`;
};

export const fullFrame: CSSProperties = { position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none" };
const W = 1920;
const H = 1080;

type Tick = { a: number; r0: number; r1: number; w: number; major: boolean; d: number };
/**
 * The bezel's ticks as shot 6 leaves them (heading-up, so turned by -48°), with the app's radii and
 * widths scaled by K: 72 minors (5 x 1.2 px at ro - 3) and 12 majors (9 x 2 px at ro - 5). Each gets
 * a seeded flight distance.
 */
const TICKS: Tick[] = [
  ...Array.from({ length: 72 }, (_, k) => ({ a: 5 * k - 48, r0: K * 185.5, r1: K * 190.5, w: 1.2 * K, major: false, d: 130 + 230 * hash01(7201, k) })),
  ...Array.from({ length: 12 }, (_, k) => ({ a: 30 * k - 48, r0: K * 181.5, r1: K * 190.5, w: 2 * K, major: true, d: 360 + 160 * hash01(7202, k) })),
];
/** The burst is over by 745. */
const BURST = 25;
/** A streak spans where its tick is now and where it was this many frames ago (motion blur). */
const LAG = 4;
const travel = (x: number) => (x <= 0 ? 0 : easeOutExpo(Math.min(1, x)));
/** Glow sleeves round a streak: [extra half-width px, opacity]. */
const GLOW_MAJOR = [[2, 0.22], [5, 0.11], [10, 0.05]] as const;
const GLOW_MINOR = [[1.5, 0.14], [4, 0.05]] as const;

const pts = (q: number[][]) => q.map((p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(" ");

/**
 * The bezel sheds its ticks on the hit: each flies out along its radius as a tapered light streak
 * (hot white head, fading tail) over a wider, faint amber taper for its glow, long while fast and short
 * as it slows. From about 728 they twinkle as they die (the score's shimmer), gone by 745. No SVG blur:
 * a full-frame blur cost about 1 s per frame.
 */
export const Burst = () => {
  const frame = useCurrentFrame();
  const u = (frame - HIT) / BURST;
  if (u < 0 || u >= 1) return null;
  const { cx, cy } = HANDOFF.logo;
  const fade = Math.pow(1 - u, 1.3);
  const cool = clamp(u / 0.45);
  const streaks = TICKS.map((t, i) => {
    const head = t.r1 + t.d * travel(u);
    const tail = t.r0 + t.d * travel(u - LAG / BURST);
    const rad = (t.a * Math.PI) / 180;
    const dx = Math.sin(rad);
    const dy = -Math.cos(rad);
    const hw = t.w * (t.major ? 0.95 : 0.8);
    const p = (r: number, s: number) => [cx + dx * r - dy * s, cy + dy * r + dx * s];
    const core = [p(head, hw), p(head, -hw), p(tail, -hw * 0.15), p(tail, hw * 0.15)];
    // Stacked sleeves, each wider and fainter, fake a soft falloff round the streak.
    const glows = (t.major ? GLOW_MAJOR : GLOW_MINOR).map(([grow, alpha]) => {
      const gw = hw + grow;
      return { alpha, q: [p(head, gw), p(head + grow * 1.2, 0), p(head, -gw), p(tail, -hw * 0.4), p(tail, hw * 0.4)] };
    });
    const sparkle = u > 0.3 ? 0.45 + 0.55 * hash01(frame * 131 + 7, i) : 1;
    return { t, i, core, glows, h: p(head, 0), tl: p(tail, 0), o: fade * sparkle * (t.major ? 1 : 0.8) };
  });
  return (
    <svg width={W} height={H} style={fullFrame}>
      <defs>
        {streaks.map(({ t, i, h, tl }) => (
          <linearGradient key={i} id={`s7-streak-${i}`} gradientUnits="userSpaceOnUse" x1={tl[0]} y1={tl[1]} x2={h[0]} y2={h[1]}>
            <stop offset={0} stopColor={t.major ? C.amber : C.tick} stopOpacity={0} />
            <stop offset={0.55} stopColor={mixHex("#ffffff", t.major ? "#ffd98a" : C.tick, cool)} stopOpacity={0.55} />
            <stop offset={1} stopColor={mixHex("#ffffff", t.major ? "#ffe3a3" : "#e6eaef", cool)} stopOpacity={1} />
          </linearGradient>
        ))}
        {streaks.map(({ i, h, tl }) => (
          <linearGradient key={i} id={`s7-glow-${i}`} gradientUnits="userSpaceOnUse" x1={tl[0]} y1={tl[1]} x2={h[0]} y2={h[1]}>
            <stop offset={0} stopColor={C.amber} stopOpacity={0} />
            <stop offset={1} stopColor={C.amber} stopOpacity={1} />
          </linearGradient>
        ))}
      </defs>
      {streaks.map(({ i, glows, o }) =>
        glows.map((g, k) => <polygon key={`${i}-${k}`} points={pts(g.q)} fill={`url(#s7-glow-${i})`} opacity={o * g.alpha} />),
      )}
      {streaks.map(({ i, core, o }) => (
        <polygon key={i} points={pts(core)} fill={`url(#s7-streak-${i})`} opacity={o} />
      ))}
    </svg>
  );
};

/** Thin amber shockwave off the bezel's edge, r 270 -> 1100 over 720-760, fading. */
export const Shockwave = () => {
  const frame = useCurrentFrame();
  const u = (frame - HIT) / 40;
  if (u < 0 || u >= 1) return null;
  const r = 270 + 830 * easeOutCubic(u);
  const o = Math.pow(1 - u, 1.5);
  const w = lerp(3.5, 1.5, u);
  const { cx, cy } = HANDOFF.logo;
  return (
    <svg width={W} height={H} style={fullFrame}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.amber} strokeWidth={w * 12} opacity={o * 0.03} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.amber} strokeWidth={w * 6} opacity={o * 0.06} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.amber} strokeWidth={w * 2.6} opacity={o * 0.16} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={mixHex(C.amber, "#ffffff", 0.35 + 0.65 * heatAt(frame))} strokeWidth={w} opacity={o} />
    </svg>
  );
};

/**
 * The flash round the ring on the hit: a wide amber halo hugging it that cools over ~10 frames (radial
 * gradient stops round the band, so no blur filter), and for three frames a faint warm light over the
 * whole frame.
 */
export const HitFlash = ({ ring }: { ring: Ring }) => {
  const frame = useCurrentFrame();
  const i = frame - HIT;
  const glow = [1, 0.85, 0.62, 0.45, 0.32, 0.22, 0.15, 0.1, 0.06, 0.03][i] ?? 0;
  const room = [1, 0.45, 0.15][i] ?? 0;
  if (glow <= 0) return null;
  const heat = heatAt(frame);
  const [r, g, b] = rgbOf(heat > 0 ? "#ffcf6e" : C.amber);
  const c = (a: number) => `rgba(${r}, ${g}, ${b}, ${(a * glow * 0.85).toFixed(3)})`;
  const rc = ring.r - ring.sw / 2;
  const hw = ring.sw * 0.9 + 16 + 10 * heat;
  const at = (k: number) => `${Math.max(0, rc + k * hw).toFixed(1)}px`;
  return (
    <>
      {room > 0 ? (
        <div
          style={{
            ...fullFrame,
            width: W,
            height: H,
            opacity: room,
            background: `radial-gradient(circle at ${ring.cx}px ${ring.cy}px, rgba(255, 210, 120, 0.13) 0px, rgba(255, 200, 100, 0.07) ${ring.r * 1.3}px, rgba(255, 200, 100, 0.02) ${ring.r * 2.6}px, rgba(255, 200, 100, 0) ${ring.r * 4}px)`,
          }}
        />
      ) : null}
      <div
        style={{
          ...fullFrame,
          width: W,
          height: H,
          background: `radial-gradient(circle at ${ring.cx}px ${ring.cy}px, ${c(0)} ${at(-2.4)}, ${c(0.12)} ${at(-1.6)}, ${c(0.45)} ${at(-0.85)}, ${c(1)} ${at(0)}, ${c(0.45)} ${at(0.85)}, ${c(0.12)} ${at(1.7)}, ${c(0)} ${at(2.6)})`,
        }}
      />
    </>
  );
};

/** Brightness of the glint the heading box leaves at 12 o'clock: up as the box goes, down as the tick grows out of it. */
const GLINT: readonly Key[] = [
  [720, 0],
  [722, 0.9, easeOutCubic],
  [724, 1],
  [728, 1, easeInOutCubic],
  [736, 0],
];

/**
 * The mark at 12 o'clock. Shot 6's heading box ("048", with its tip) rides the collapsing ring, narrows
 * and fades over 720-723; it leaves a white-hot glint on the ring there (a star point) that the tick
 * springs out of from 728, so the heading box and the logo's tick read as one mark.
 */
export const TopMark = ({ ring }: { ring: Ring }) => {
  const frame = useCurrentFrame();
  const o = [1, 0.7, 0.4, 0.15][frame - HIT] ?? 0;
  const g = track(frame, GLINT);
  if (o <= 0 && g <= 0) return null;
  const s = (ring.r / HANDOFF.logo.r) * K;
  const x = ring.cx;
  const y = ring.cy - ring.r + ring.sw / 2;
  const disc = ring.cy - ring.r + ring.sw;
  const bw = 38 * s * (1 - 0.5 * clamp((frame - HIT) / 3));
  return (
    <>
      {o > 0 ? (
        <svg width={W} height={H} style={fullFrame}>
          <g opacity={o}>
            <rect x={x - bw / 2} y={y - 9.5 * s} width={bw} height={19 * s} rx={4 * s} fill={C.bezel} stroke={C.amber} strokeWidth={1.2 * s} />
            <text x={x} y={y + 0.5 * s} textAnchor="middle" dominantBaseline="central" fontFamily={MONO} fontWeight={700} fontSize={11.5 * s} fill={C.amber} opacity={o}>
              048
            </text>
            <path d={`M${x - 4.5 * s} ${disc - 5 * s}h${9 * s}l${-4.5 * s} ${6 * s}z`} fill={C.amber} stroke="#000" strokeWidth={0.8 * s} />
          </g>
        </svg>
      ) : null}
      {g > 0 ? (
        <div style={{ position: "absolute", left: x, top: y, width: 0, height: 0, opacity: g, pointerEvents: "none" }}>
          <div
            style={{
              position: "absolute", left: -30, top: -30, width: 60, height: 60, borderRadius: "50%",
              background: "radial-gradient(circle closest-side, #ffffff 0%, rgba(255, 246, 222, 0.95) 12%, rgba(255, 214, 130, 0.5) 35%, rgba(240, 180, 41, 0.14) 65%, rgba(240, 180, 41, 0) 100%)",
            }}
          />
          <div style={{ position: "absolute", left: -1, top: -46, width: 2, height: 92, background: "linear-gradient(rgba(255, 244, 214, 0), rgba(255, 244, 214, 0.85) 50%, rgba(255, 244, 214, 0))" }} />
          <div style={{ position: "absolute", left: -26, top: -1, width: 52, height: 2, background: "linear-gradient(90deg, rgba(255, 244, 214, 0), rgba(255, 244, 214, 0.7) 50%, rgba(255, 244, 214, 0))" }} />
        </div>
      ) : null}
    </>
  );
};

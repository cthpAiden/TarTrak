import { useId, type CSSProperties, type ReactNode } from "react";
import { useCurrentFrame } from "remotion";
import { C } from "../../theme.ts";
import { rng } from "../../lib/random.ts";
import { sway } from "./shot6.ts";

/** The brief's dusk tones (dark blue-greys between the theme's bg and line colours). */
const SKY_TOP = "#0d1016";
const SKY_LOW = "#1b2230";
const FAR = "#141a22";
const MID = "#10151b";

/**
 * The drawn area in stage px: past the 1920x1080 frame on every side, most on the right and top, so the
 * zoomed stage (pull-back from the iris, push-in to the bezel) and the sway never reach an edge.
 */
const B = { x: -80, y: -160, w: 2480, h: 1360 } as const;
const HORIZON = 640;

const rgbOf = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(", ");
const amber = (a: number) => `rgba(${rgbOf(C.amber)}, ${a})`;
const light = (a: number) => `rgba(${rgbOf(C.fg)}, ${a})`;

// Static silhouettes (drawn once) --------------------------------------------------------------------

/** A ragged line of conifers along the horizon, on a slow roll of land. */
const TREES = (() => {
  const r = rng(6101);
  const base = (x: number) => HORIZON + 6 * Math.sin(x / 260) + 4 * Math.sin(x / 97 + 1);
  let d = `M${B.x} ${HORIZON + 90}L${B.x} ${base(B.x)}`;
  for (let x = B.x; x < B.x + B.w; ) {
    const w = 16 + r() * 30;
    const h = 22 + r() * 46 + (r() < 0.12 ? 26 : 0);
    const b = base(x + w / 2);
    // three tiers of branches narrowing to a spike
    d += `L${x} ${b}L${x + w * 0.2} ${b - h * 0.34}L${x + w * 0.1} ${b - h * 0.34}L${x + w * 0.32} ${b - h * 0.66}L${x + w * 0.24} ${b - h * 0.66}`;
    d += `L${x + w / 2} ${b - h}L${x + w * 0.76} ${b - h * 0.66}L${x + w * 0.68} ${b - h * 0.66}L${x + w * 0.9} ${b - h * 0.34}L${x + w * 0.8} ${b - h * 0.34}L${x + w} ${b}`;
    x += w * (0.55 + r() * 0.35);
  }
  return `${d}L${B.x + B.w} ${HORIZON + 90}Z`;
})();

/** Sawtooth factory roof, a gabled warehouse, a shed, a water tower, and a line of power poles receding right. */
const INDUSTRY = (() => {
  const parts: string[] = [];
  // factory: five north-light teeth
  let d = "M40 780L40 574";
  for (let i = 0; i < 5; i++) d += `L${40 + i * 96 + 70} 540L${40 + i * 96 + 70} 574L${40 + (i + 1) * 96} 574`;
  parts.push(`${d}L520 574L520 780Z`);
  // gabled warehouse with a roof vent
  parts.push("M540 780L540 604L720 548L900 604L900 780Z", "M700 556h40v-18h-40z");
  // low shed and a chimney
  parts.push("M900 780L900 650L1050 650L1050 780Z", "M960 650h14v-120h-14z");
  return parts;
})();

/** The near ground: a rise with a ragged edge of rubble and scrub that hides the buildings' bases. */
const GROUND_TOP = 690;
const GROUND = (() => {
  const r = rng(6113);
  let d = `M${B.x} ${B.y + B.h}`;
  for (let x = B.x; x <= B.x + B.w; x += 12) {
    const bump = r() < 0.08 ? 6 + r() * 10 : r() * 3;
    d += `L${x} ${GROUND_TOP + 7 * Math.sin(x / 210 + 0.6) + 4 * Math.sin(x / 77) - bump}`;
  }
  return `${d}L${B.x + B.w} ${B.y + B.h}Z`;
})();

/** Water tower: tank, cone roof, walkway, splayed legs with cross bracing. */
const TOWER = { x: 1225, top: 300, tank: [336, 420], w: 120, foot: 712 } as const;

/** Power poles receding to the right, with three sagging wires between neighbours. */
const POLES = [
  { x: 250, top: 250, foot: 860, arm: 56, w: 9 },
  { x: 690, top: 395, foot: 760, arm: 38, w: 6 },
  { x: 1010, top: 470, foot: 712, arm: 28, w: 4.5 },
  { x: 1320, top: 520, foot: 690, arm: 22, w: 3.5 },
  { x: 1600, top: 552, foot: 676, arm: 17, w: 3 },
  { x: 1860, top: 574, foot: 668, arm: 14, w: 2.5 },
  { x: 2100, top: 590, foot: 662, arm: 11, w: 2 },
  { x: 2320, top: 601, foot: 658, arm: 9, w: 1.8 },
] as const;
const WIRES = (() => {
  const out: string[] = [];
  for (let i = 0; i < POLES.length - 1; i++) {
    const a = POLES[i];
    const b = POLES[i + 1];
    for (const side of [-1, 0, 1]) {
      const ax = a.x + (side * a.arm) / 2;
      const bx = b.x + (side * b.arm) / 2;
      const ay = a.top + (side === 0 ? -a.arm * 0.18 : 0);
      const by = b.top + (side === 0 ? -b.arm * 0.18 : 0);
      const sag = 0.07 * (bx - ax);
      out.push(`M${ax} ${ay}Q${(ax + bx) / 2} ${(ay + by) / 2 + sag} ${bx} ${by}`);
    }
  }
  return out;
})();

/** Dust motes: 40 seeded bokeh dots in the light. */
const MOTES = (() => {
  const r = rng(6107);
  return Array.from({ length: 40 }, () => ({
    x: B.x + r() * B.w,
    y: 80 + r() * 900,
    size: 3 + r() ** 2 * 16,
    a: 0.1 + r() * 0.3,
    vx: 0.12 + r() * 0.4,
    vy: -(0.05 + r() * 0.3),
    ph: r() * Math.PI * 2,
    warm: r() < 0.55,
  }));
})();

const Silhouettes = ({ uid }: { uid: string }) => (
  <svg width={B.w} height={B.h} viewBox={`${B.x} ${B.y} ${B.w} ${B.h}`} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
    <defs>
      <linearGradient id={`${uid}-ground`} gradientUnits="userSpaceOnUse" x1={0} y1={GROUND_TOP - 20} x2={0} y2={1080}>
        <stop offset={0} stopColor={MID} />
        <stop offset={0.45} stopColor={C.deep} />
        <stop offset={1} stopColor={C.deep} />
      </linearGradient>
    </defs>
    <g fill={MID}>
      {INDUSTRY.map((d, i) => (
        <path key={i} d={d} />
      ))}
      {/* water tower */}
      <path d={`M${TOWER.x - TOWER.w / 2 - 6} ${TOWER.tank[0]}L${TOWER.x} ${TOWER.top}L${TOWER.x + TOWER.w / 2 + 6} ${TOWER.tank[0]}Z`} />
      <rect x={TOWER.x - 2} y={TOWER.top - 16} width={4} height={18} />
      <rect x={TOWER.x - TOWER.w / 2} y={TOWER.tank[0]} width={TOWER.w} height={TOWER.tank[1] - TOWER.tank[0]} rx={6} />
      <rect x={TOWER.x - TOWER.w / 2 - 10} y={TOWER.tank[1] - 4} width={TOWER.w + 20} height={5} />
    </g>
    <path d={GROUND} fill={`url(#${uid}-ground)`} />
    <g stroke={MID} fill="none" strokeLinecap="square">
      {[-1, -0.35, 0.35, 1].map((k) => (
        <line key={k} x1={TOWER.x + k * (TOWER.w / 2 - 8)} y1={TOWER.tank[1]} x2={TOWER.x + k * (TOWER.w / 2 + 22)} y2={TOWER.foot} strokeWidth={Math.abs(k) === 1 ? 7 : 4} />
      ))}
      {[[440, 540], [540, 630], [630, TOWER.foot]].map(([y0, y1]) => {
        const at = (y: number) => TOWER.w / 2 - 8 + ((y - TOWER.tank[1]) / (TOWER.foot - TOWER.tank[1])) * 30;
        return (
          <g key={y0} strokeWidth={2.5}>
            <line x1={TOWER.x - at(y0)} y1={y0} x2={TOWER.x + at(y1)} y2={y1} />
            <line x1={TOWER.x + at(y0)} y1={y0} x2={TOWER.x - at(y1)} y2={y1} />
          </g>
        );
      })}
      {POLES.map((p) => (
        <g key={p.x}>
          <line x1={p.x} y1={p.top - p.arm * 0.25} x2={p.x} y2={p.foot} strokeWidth={p.w} />
          <line x1={p.x - p.arm / 2 - 2} y1={p.top} x2={p.x + p.arm / 2 + 2} y2={p.top} strokeWidth={p.w * 0.7} />
        </g>
      ))}
      <g strokeWidth={1.6} strokeLinecap="round">
        {WIRES.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
    </g>
  </svg>
);

const Trees = () => (
  <svg width={B.w} height={B.h} viewBox={`${B.x} ${B.y} ${B.w} ${B.h}`} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
    <path d={TREES} fill={FAR} />
  </svg>
);

// ------------------------------------------------------------------------------------------------------

const fill: CSSProperties = { position: "absolute", left: 0, top: 0, width: B.w, height: B.h };
/** Container-space % of a stage y. */
const yPct = (y: number) => `${(((y - B.y) / B.h) * 100).toFixed(2)}%`;

/**
 * An abstract dusk first-person view behind the overlay (nothing from a real game): sky, far treeline,
 * mid industrial silhouettes (factory roofs, water tower, power lines), drifting fog, amber god rays
 * from the upper left and dust motes, each layer swaying with a slow handheld motion by its depth,
 * under a heavy vignette and a 2 px blur so the minimap stays the sharp element. Fills the stage with
 * bleed; the caller fades it.
 */
export const GameBackdrop = () => {
  const frame = useCurrentFrame();
  const uid = `gb${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const sw = sway(frame);
  // The player turns slowly to the right: the view drifts left, near layers faster.
  const drift = -(frame - 600) * 0.22;
  const layer = (depth: number, children: ReactNode, extra?: CSSProperties) => (
    <div
      style={{
        ...fill,
        transformOrigin: `${960 - B.x}px ${540 - B.y}px`,
        transform: `translate(${sw.x * depth + drift * depth}px, ${sw.y * depth}px) rotate(${sw.rot * depth}deg)`,
        ...extra,
      }}
    >
      {children}
    </div>
  );
  const breathe = 0.85 + 0.15 * Math.sin(frame * 0.05);
  const rayTurn = 0.6 * Math.sin(frame * 0.013);
  const src = { x: -260 - B.x, y: -220 - B.y };

  return (
    <div style={{ position: "absolute", left: B.x, top: B.y, width: B.w, height: B.h, overflow: "hidden", filter: "blur(2px)" }}>
      {layer(
        0.25,
        <div
          style={{
            ...fill,
            background: [
              `radial-gradient(ellipse 1000px 240px at ${380 - B.x}px ${HORIZON - 20 - B.y}px, ${amber(0.17)}, ${amber(0)})`,
              `radial-gradient(ellipse 1600px 620px at ${200 - B.x}px ${HORIZON - 140 - B.y}px, ${amber(0.07)}, ${amber(0)})`,
              `linear-gradient(180deg, ${SKY_TOP} 0%, ${SKY_TOP} ${yPct(-60)}, ${SKY_LOW} ${yPct(HORIZON - 10)}, ${FAR} ${yPct(HORIZON + 40)}, ${SKY_TOP} ${yPct(860)}, ${C.deep} 100%)`,
            ].join(", "),
          }}
        />,
      )}
      {layer(0.4, <Trees />)}
      {layer(0.7, <Silhouettes uid={uid} />)}
      {layer(
        0.45,
        <div
          style={{
            ...fill,
            opacity: breathe,
            transformOrigin: `${src.x}px ${src.y}px`,
            transform: `rotate(${rayTurn}deg)`,
            background: `conic-gradient(from 0deg at ${src.x}px ${src.y}px, ${amber(0)} 0deg, ${amber(0)} 111deg, ${amber(0.13)} 115.5deg, ${amber(0.04)} 119deg, ${amber(0)} 122deg, ${amber(0)} 126deg, ${amber(0.09)} 129.5deg, ${amber(0)} 133deg, ${amber(0)} 138deg, ${amber(0.05)} 141deg, ${amber(0.13)} 145.5deg, ${amber(0.04)} 150deg, ${amber(0)} 154deg, ${amber(0)} 360deg)`,
            maskImage: `radial-gradient(circle at ${src.x}px ${src.y}px, black 0px, rgba(0, 0, 0, 0.85) 800px, transparent 2200px)`,
            WebkitMaskImage: `radial-gradient(circle at ${src.x}px ${src.y}px, black 0px, rgba(0, 0, 0, 0.85) 800px, transparent 2200px)`,
          }}
        />,
      )}
      {layer(
        1,
        <>
          {[
            { y: HORIZON + 10, w: 1500, h: 70, a: 0.08, v: 0.35, x0: 500 },
            { y: HORIZON + 70, w: 2000, h: 110, a: 0.05, v: -0.25, x0: 1500 },
            { y: HORIZON - 40, w: 1200, h: 60, a: 0.04, v: 0.5, x0: 1900 },
          ].map((f, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                left: f.x0 + f.v * (frame - 600) - f.w / 2 - B.x,
                top: f.y - f.h / 2 - B.y,
                width: f.w,
                height: f.h,
                background: `radial-gradient(ellipse closest-side, ${light(f.a)}, ${light(f.a * 0.45)} 55%, ${light(0)})`,
              }}
            />
          ))}
        </>,
      )}
      {layer(
        1.25,
        <>
          {MOTES.map((m, i) => {
            const t = frame - 600;
            const x = m.x + m.vx * t + 6 * Math.sin(t * 0.03 + m.ph) - B.x;
            const y = m.y + m.vy * t + 4 * Math.cos(t * 0.025 + m.ph) - B.y;
            const tw = 0.7 + 0.3 * Math.sin(t * 0.09 + m.ph * 3);
            const c = m.warm ? amber : light;
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: x - m.size,
                  top: y - m.size,
                  width: 2 * m.size,
                  height: 2 * m.size,
                  borderRadius: "50%",
                  background: `radial-gradient(circle closest-side, ${c(m.a * tw)}, ${c(m.a * tw * 0.5)} 45%, ${c(0)})`,
                }}
              />
            );
          })}
        </>,
      )}
      <div
        style={{
          ...fill,
          // heavy, but centred up and left toward the light so the rays keep their source
          background: `radial-gradient(ellipse 1350px 800px at ${820 - B.x}px ${440 - B.y}px, rgba(0, 0, 0, 0) 32%, rgba(0, 0, 0, 0.42) 70%, rgba(0, 0, 0, 0.8) 100%)`,
        }}
      />
    </div>
  );
};

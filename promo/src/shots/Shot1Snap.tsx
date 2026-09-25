import type { CSSProperties } from "react";
import { useId } from "react";
import { AbsoluteFill, spring, useCurrentFrame } from "remotion";
import { Headline } from "../components/Headline.tsx";
import { Keycap } from "../components/Keycap.tsx";
import { ScrambleText, type Highlight } from "../components/ScrambleText.tsx";
import { ShutterIris } from "../components/ShutterIris.tsx";
import { MONO } from "../fonts.ts";
import { easeInCubic, easeInExpo, easeInOutCubic, easeOutCubic, lerp, linear, prog, track } from "../lib/ease.ts";
import { scramble } from "../lib/text.ts";
import { C, SPRING_POP } from "../theme.ts";

const CX = 960;
const CY = 540;
const amber = (a: number) => `rgba(240, 180, 41, ${a})`;
const pop = (frame: number, at: number) => (frame < at ? 0 : spring({ frame: frame - at, fps: 60, config: SPRING_POP }));

// ---- crosshair ------------------------------------------------------------------------------------

/** On at 8, off 12, on 16, off 18, on 20 and stays. */
const crosshairOn = (f: number) => (f >= 8 && f < 12) || (f >= 16 && f < 18) || f >= 20;

const Crosshair = ({ frame }: { frame: number }) => {
  if (!crosshairOn(frame) || frame >= 68) return null;
  // The keycap rising under it pushes it up into the gap between headline and key; the press kicks it up and out.
  const kick = prog(frame, 60, 70, easeOutCubic);
  const y = lerp(CY, 420, pop(frame, 21)) - 70 * kick;
  const arm = (x1: number, y1: number, x2: number, y2: number) => <line x1={x1} y1={y1} x2={x2} y2={y2} />;
  return (
    <svg
      width={80}
      height={80}
      viewBox="-40 -40 80 80"
      style={{
        position: "absolute", left: CX - 40, top: y - 40, overflow: "visible",
        opacity: 1 - prog(frame, 60, 66, easeInCubic), filter: `drop-shadow(0 0 4px ${amber(0.55)})`,
      }}
    >
      <g stroke={C.amber} strokeWidth={1.5} fill="none">
        {arm(-28, 0, -8, 0)}
        {arm(8, 0, 28, 0)}
        {arm(0, -28, 0, -8)}
        {arm(0, 8, 0, 28)}
        <circle r={3} />
      </g>
    </svg>
  );
};

// ---- filename -------------------------------------------------------------------------------------

const FILENAME = "2026-09-25[14-32]_-182.40, 2.10, -71.03_0.00000, 0.40674, 0.00000, 0.91355 (0).png";
const FONT = 34;
/** IBM Plex Mono advances 600/1000 em per glyph. */
const ADVANCE = FONT * 0.6;
const LINE_LEFT = CX - (FILENAME.length * ADVANCE) / 2;
const DECODE = [70, 96] as const;
const DISSOLVE = 100;
type Range = { start: number; end: number };
const rangeOf = (s: string): Range => {
  const start = FILENAME.indexOf(s);
  return { start, end: start + s.length };
};
const SRC = { x: rangeOf("-182.40"), z: rangeOf("-71.03"), q: rangeOf("0.00000, 0.40674, 0.00000, 0.91355") };
const HIGHLIGHTS: Highlight[] = [SRC.x, SRC.z, SRC.q].map((r) => ({ ...r, color: C.amber }));
const midX = (r: Range) => LINE_LEFT + ((r.start + r.end) / 2) * ADVANCE;

const lineStyle: CSSProperties = { fontSize: FONT, lineHeight: `${FONT}px`, color: C.muted };

/** ScrambleText's resolved-highlight glow, so the dissolve starts on exactly the look ScrambleText left. */
const highlightGlow = (h: Highlight, frame: number) => {
  const age = frame - (DECODE[0] + (h.end / FILENAME.length) * (DECODE[1] - DECODE[0]));
  const flare = age >= 0 && age < 10 ? 1 - age / 10 : 0;
  return `0 0 ${10 + 14 * flare}px color-mix(in srgb, ${h.color} ${Math.round(55 + 35 * flare)}%, transparent)`;
};

/** Character i starts dissolving at this frame (right to left over 4 frames) and is gone 2.5 frames later. */
const dissolveAt = (i: number) => DISSOLVE + ((FILENAME.length - 1 - i) / (FILENAME.length - 1)) * 4;
const DISSOLVE_LEN = 2.5;

/** f100-106: characters re-scramble (a new glyph every frame), blur and fade out, right to left. */
const Dissolve = ({ frame }: { frame: number }) => (
  <span style={{ fontFamily: MONO, whiteSpace: "pre", fontVariantNumeric: "tabular-nums", ...lineStyle }}>
    {FILENAME.split("").map((ch, i) => {
      const q = prog(frame, dissolveAt(i), dissolveAt(i) + DISSOLVE_LEN);
      const h = HIGHLIGHTS.find((r) => i >= r.start && i < r.end);
      const cell: CSSProperties = { display: "inline-block", width: ADVANCE };
      return q <= 0 ? (
        <span key={i} style={h ? { ...cell, color: h.color, textShadow: highlightGlow(h, frame) } : cell}>
          {ch}
        </span>
      ) : (
        // Seeds 97 apart: scramble() adds the seed to the time step, so neighbouring seeds would repeat each other's glyphs a frame later.
        <span key={i} style={{ ...cell, opacity: 0.45 * (1 - q), filter: `blur(${(2.5 * q).toFixed(2)}px)` }}>
          {scramble(ch, 0, frame, 11 + 97 * i, 1)}
        </span>
      );
    })}
  </span>
);

const Filename = ({ frame }: { frame: number }) => {
  if (frame < DECODE[0] || frame > DISSOLVE + 7) return null;
  // 1 px up puts the digits' ink (rows 528-551) centred on CY, level with the caret, the chips' path and the point.
  return (
    <div style={{ position: "absolute", left: LINE_LEFT, top: CY - FONT / 2 - 1, height: FONT, whiteSpace: "pre" }}>
      {frame < DISSOLVE ? (
        <ScrambleText text={FILENAME} from={DECODE[0]} to={DECODE[1]} seed={5} style={lineStyle} highlights={HIGHLIGHTS} />
      ) : (
        <Dissolve frame={frame} />
      )}
    </div>
  );
};

/** The read head: an amber caret riding the decode front; it rests 2 frames at the end of the line, then goes. */
const Caret = ({ frame }: { frame: number }) => {
  if (frame < DECODE[0] || frame >= DECODE[1] + 2) return null;
  const done = Math.floor(prog(frame, DECODE[0], DECODE[1]) * FILENAME.length);
  return (
    <div
      style={{
        position: "absolute", left: LINE_LEFT + done * ADVANCE - 1, top: CY - 21, width: 2, height: 42,
        background: C.amber, boxShadow: `0 0 10px ${amber(0.7)}`,
      }}
    />
  );
};

// ---- chips ----------------------------------------------------------------------------------------

type ChipSpec = { label: string; value: string; src: Range; x: number; at: number };
const CHIPS: ChipSpec[] = [
  { label: "X", value: "-182.4", src: SRC.x, x: 560, at: 80 },
  { label: "Z", value: "-71.0", src: SRC.z, x: 960, at: 88 },
  { label: "HDG", value: "048°", src: SRC.q, x: 1360, at: 96 },
];
const CHIP_Y = 430;
const CHIP_FONT = 30;
const CHIP_H = 54;
const CHIP_PAD = 22;
const CHIP_GAP = 12;
/** Pill width from its text (mono glyphs advance 0.6 em); Remotion's border-box counts padding and border. */
const chipW = (c: ChipSpec) => 2 * CHIP_PAD + 2 + CHIP_GAP + (c.label.length + c.value.length) * CHIP_FONT * 0.6;
const FLY = [104, 116] as const;
/** Bracket over the source text: the connector's foot. */
const BRACKET_Y = CY - 24;
/** How much path (frames) a light trail covers behind a flying chip. */
const TRAIL = 2.5;

/** Where a chip is on frame f (fractions allowed): lifted from its source, wound up, then flown into the centre. */
function chipAt(c: ChipSpec, f: number) {
  const lift = pop(f, c.at);
  // Anticipation: a breath out before the fly. The row spreads 4% from the centre (so it stays level) and the chips grow 6%.
  const wind = track(f, [[100, 0, easeOutCubic], [109, 1, easeInCubic], [113, 0]]);
  const spread = 1 + 0.04 * wind;
  const x = CX + (lerp(midX(c.src), c.x, lift) - CX) * spread;
  const y = CY + (lerp(CY - 16, CHIP_Y, lift) - CY) * spread;
  const t = prog(f, FLY[0], FLY[1], easeInExpo);
  const scale = lerp(lerp(0.55, 1, lift) * (1 + 0.06 * wind), 0.15, t);
  return { x: lerp(x, CX, t), y: lerp(y, CY, t), scale, fly: t };
}

/** A pill centred on its parent's origin. `charge` fills it with amber light (hot core), `text` fades the readout. */
const Pill = ({ c, charge, text }: { c: ChipSpec; charge: number; text: number }) => (
  <div
    style={{
      position: "absolute", left: -chipW(c) / 2, top: -CHIP_H / 2, width: chipW(c), height: CHIP_H,
      display: "flex", alignItems: "center", justifyContent: "center", gap: CHIP_GAP, padding: `0 ${CHIP_PAD}px`,
      borderRadius: CHIP_H / 2,
      background: `color-mix(in srgb, ${C.amber} ${Math.round(charge * 100)}%, rgba(11, 13, 16, 0.92))`,
      border: `1px solid color-mix(in srgb, #ffe7ad ${Math.round(charge * 100)}%, ${C.amber})`,
      boxShadow: `0 8px 22px rgba(0, 0, 0, ${0.45 * (1 - charge)}), 0 0 ${18 + 26 * charge}px ${amber(0.2 + 0.45 * charge)}`,
      fontFamily: MONO, fontSize: CHIP_FONT, lineHeight: 1, color: C.amber, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums",
    }}
  >
    {charge > 0 ? (
      <div
        style={{
          position: "absolute", inset: 0, borderRadius: CHIP_H / 2, opacity: charge,
          background: "radial-gradient(closest-side, rgba(255, 246, 220, 0.95), rgba(255, 214, 120, 0.55) 55%, rgba(240, 180, 41, 0))",
        }}
      />
    ) : null}
    <span style={{ position: "relative", fontWeight: 500, opacity: 0.55 * text }}>{c.label}</span>
    <span style={{ position: "relative", fontWeight: 600, opacity: text, textShadow: `0 0 12px ${amber(0.35)}` }}>{c.value}</span>
  </div>
);

const at = (x: number, y: number, scale: number): CSSProperties => ({
  position: "absolute", left: x, top: y, width: 0, height: 0, transform: `scale(${scale})`,
});
const charged = (fly: number) => prog(fly, 0.04, 0.4);

/** Ghost weights for the 5 previous frames. */
const GHOST = [0.5, 0.34, 0.22, 0.13, 0.06];

/**
 * Soft amber copies of a flying chip at its previous 5 frames' positions (screen blend, tapering and fading
 * with age). Only while it flies and only as strong as it is fast, so neither the spring lift nor the slow
 * start leaves a smear.
 */
const Ghosts = ({ c, frame }: { c: ChipSpec; frame: number }) => {
  if (frame < FLY[0] + 5 || frame > FLY[1]) return null;
  const now = chipAt(c, frame);
  return (
    <>
      {GHOST.map((w, i) => {
        const s = chipAt(c, frame - i - 1);
        const a = w * prog(now.fly, 0.02, 0.1) * prog(Math.hypot(now.x - s.x, now.y - s.y), 5 * (i + 1), 16 * (i + 1));
        if (a < 0.01) return null;
        return (
          <div key={i} style={{ ...at(s.x, s.y, s.scale * (1 - 0.1 * (i + 1))), opacity: a, mixBlendMode: "screen" }}>
            <div
              style={{
                position: "absolute", left: -chipW(c) / 2, top: -CHIP_H / 2, width: chipW(c), height: CHIP_H,
                background: "radial-gradient(closest-side, rgba(255, 236, 190, 0.9), rgba(240, 180, 41, 0.5) 60%, rgba(240, 180, 41, 0))",
              }}
            />
          </div>
        );
      })}
    </>
  );
};

const Chip = ({ c, frame }: { c: ChipSpec; frame: number }) => {
  if (frame < c.at || frame > FLY[1]) return null;
  const now = chipAt(c, frame);
  return (
    <div style={{ ...at(now.x, now.y, now.scale), opacity: prog(frame, c.at, c.at + 3) }}>
      <Pill c={c} charge={charged(now.fly)} text={1 - prog(now.fly, 0.06, 0.3)} />
    </div>
  );
};

/**
 * Light trails of the flying chips: a tapered streak from where each chip was TRAIL frames ago to where it
 * is, with a hot core. After the hit the tails keep coming, so the streaks are drawn into the point by f119.
 */
const Trails = ({ frame }: { frame: number }) => {
  const id = `trail-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  if (frame < FLY[0] + 6 || frame >= FLY[1] + 3) return null;
  const fade = 1 - prog(frame, FLY[1], FLY[1] + 3);
  const streaks = CHIPS.map((c, i) => {
    const head = chipAt(c, frame);
    const tail = chipAt(c, frame - TRAIL);
    const len = Math.hypot(head.x - tail.x, head.y - tail.y);
    if (len < 6) return null;
    const nx = -(head.y - tail.y) / len;
    const ny = (head.x - tail.x) / len;
    const w = (CHIP_H * head.scale) / 2;
    const quad = (k: number) =>
      `M${head.x + nx * w * k} ${head.y + ny * w * k}L${tail.x} ${tail.y}L${head.x - nx * w * k} ${head.y - ny * w * k}Z`;
    const strength = fade * prog(len, 6, 60);
    return (
      <g key={i}>
        <linearGradient id={`${id}-${i}`} gradientUnits="userSpaceOnUse" x1={head.x} y1={head.y} x2={tail.x} y2={tail.y}>
          <stop offset={0} stopColor={C.amber} stopOpacity={0.75 * strength} />
          <stop offset={1} stopColor={C.amber} stopOpacity={0} />
        </linearGradient>
        <linearGradient id={`${id}-${i}-core`} gradientUnits="userSpaceOnUse" x1={head.x} y1={head.y} x2={tail.x} y2={tail.y}>
          <stop offset={0} stopColor="#fff1cc" stopOpacity={0.9 * strength} />
          <stop offset={0.7} stopColor="#fff1cc" stopOpacity={0} />
        </linearGradient>
        <path d={quad(0.9)} fill={`url(#${id}-${i})`} />
        <path d={quad(0.22)} fill={`url(#${id}-${i}-core)`} />
      </g>
    );
  });
  return (
    <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, overflow: "visible", mixBlendMode: "screen" }}>
      {streaks}
    </svg>
  );
};

/** Brackets over the source text and the connectors up to the chips (one SVG for all three). */
const Leaders = ({ frame }: { frame: number }) => {
  if (frame < CHIPS[0].at || frame >= FLY[0] + 2) return null;
  return (
    <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
      {CHIPS.map((c) => {
        if (frame < c.at) return null;
        // While this source's characters dissolve, its bracket fades and the connector is pulled up into the chip.
        const gone = prog(frame, dissolveAt(c.src.end - 1), dissolveAt(c.src.start) + DISSOLVE_LEN, easeInOutCubic);
        const open = prog(frame, c.at, c.at + 5, easeOutCubic);
        const draw = prog(frame, c.at, c.at + 6, easeOutCubic);
        const x0 = LINE_LEFT + c.src.start * ADVANCE + 2;
        const x1 = LINE_LEFT + c.src.end * ADVANCE - 2;
        const mx = midX(c.src);
        const half = ((x1 - x0) / 2) * open;
        const chip = chipAt(c, frame);
        const top = { x: chip.x, y: chip.y + (CHIP_H / 2) * chip.scale };
        const foot = { x: lerp(mx, top.x, gone), y: lerp(BRACKET_Y, top.y, gone) };
        const head = { x: lerp(foot.x, top.x, draw), y: lerp(foot.y, top.y, draw) };
        return (
          <g key={c.label} stroke={C.amber} fill="none" strokeWidth={1}>
            <path d={`M${mx - half} ${BRACKET_Y + 6}V${BRACKET_Y}H${mx + half}V${BRACKET_Y + 6}`} opacity={0.75 * (1 - gone)} />
            <line x1={foot.x} y1={foot.y} x2={head.x} y2={head.y} opacity={0.8} />
            <circle cx={foot.x} cy={foot.y} r={2} fill={C.amber} stroke="none" opacity={1 - gone} />
          </g>
        );
      })}
    </svg>
  );
};

// ---- collapse -------------------------------------------------------------------------------------

const Streak = ({ length, thick, vertical, opacity }: { length: number; thick: number; vertical: boolean; opacity: number }) => (
  <div
    style={{
      position: "absolute",
      left: vertical ? -thick / 2 : -length / 2,
      top: vertical ? -length / 2 : -thick / 2,
      width: vertical ? thick : length,
      height: vertical ? length : thick,
      borderRadius: thick,
      opacity,
      background: `linear-gradient(${vertical ? 180 : 90}deg, ${amber(0)}, #ffe3a1 50%, ${amber(0)})`,
    }}
  />
);

/** f108-119: the glow gathers at the centre, the chips hit it at 116 (flare, bloom, pop) and it settles into the 8 px point. */
const Point = ({ frame }: { frame: number }) => {
  if (frame < 108) return null;
  const hit = frame >= FLY[1];
  const glow = prog(frame, 108, 119, easeInCubic);
  const bloom = hit ? 1 - prog(frame, FLY[1], FLY[1] + 4, easeOutCubic) : 0;
  const flare = track(frame, [[FLY[1] - 1, 0, linear], [FLY[1], 1, easeOutCubic], [119, 0.12]]);
  const len = 200 * (1 + 0.15 * prog(frame, FLY[1], 119));
  const core = hit ? 1 + 0.5 * (1 - prog(frame, FLY[1], 119, easeOutCubic)) : 0.5 * prog(frame, 112, FLY[1], easeInCubic);
  return (
    <div style={{ position: "absolute", left: CX, top: CY, width: 0, height: 0 }}>
      <div
        style={{
          position: "absolute", left: -80, top: -80, width: 160, height: 160, borderRadius: "50%",
          background: `radial-gradient(closest-side, ${amber(0.5 * glow)}, ${amber(0.14 * glow)} 45%, ${amber(0)})`,
          transform: `scale(${0.35 + 0.65 * glow})`,
        }}
      />
      {bloom > 0 ? (
        <div
          style={{
            position: "absolute", left: -150, top: -150, width: 300, height: 300, borderRadius: "50%", opacity: bloom,
            background: `radial-gradient(closest-side, rgba(255, 231, 173, 0.4), ${amber(0.12)} 40%, ${amber(0)})`,
          }}
        />
      ) : null}
      {flare > 0 ? (
        <>
          <Streak length={len} thick={2} vertical={false} opacity={flare} />
          <Streak length={len} thick={2} vertical opacity={flare * 0.85} />
          <Streak length={len * 0.6} thick={8} vertical={false} opacity={flare * 0.22} />
        </>
      ) : null}
      {core > 0 ? (
        <div
          style={{
            position: "absolute", left: -4, top: -4, width: 8, height: 8, borderRadius: "50%",
            background: `radial-gradient(circle, #fff6dc 0 35%, ${C.amber} 75%)`,
            boxShadow: `0 0 10px 2px ${amber(0.75)}, 0 0 3px 1px rgba(255, 240, 200, 0.6)`,
            transform: `scale(${core})`,
          }}
        />
      ) : null}
    </div>
  );
};

// ---- shot -----------------------------------------------------------------------------------------

/**
 * Shot 1, SNAP (f0-119): a crosshair blinks, "ONE KEY." rises over a PRT SC keycap, the key is pressed
 * on beat 2 (f60), the shutter fires (flash f66), the screenshot filename decodes, X / Z / heading lift
 * out as chips and collapse into the single amber point that becomes the marker in shot 2 (f119: 8 px at
 * (960, 540)).
 */
export const Shot1Snap = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      {frame < 68 ? (
        <>
          <Keycap label="PRT SC" sub="SCREENSHOT" x={CX} y={600} size={180} appearAt={20} pressAt={60} releaseAt={72} />
          <Headline lines={[{ text: "ONE KEY.", accent: "KEY." }]} at={[14]} out={60} x={CX} y={330} size={120} align="center" />
        </>
      ) : null}
      <Crosshair frame={frame} />
      <Filename frame={frame} />
      <Caret frame={frame} />
      <Leaders frame={frame} />
      {CHIPS.map((c) => (
        <Ghosts key={c.label} c={c} frame={frame} />
      ))}
      <Trails frame={frame} />
      {CHIPS.map((c) => (
        <Chip key={c.label} c={c} frame={frame} />
      ))}
      <Point frame={frame} />
      <ShutterIris at={64} />
    </AbsoluteFill>
  );
};

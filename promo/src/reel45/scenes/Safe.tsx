import { AbsoluteFill, spring, useCurrentFrame } from "remotion";
import { COND, MONO } from "../../fonts.ts";
import { C, SPRING_POP } from "../../theme.ts";
import { clamp, easeInCubic, easeOutCubic, easeOutExpo, prog } from "../../lib/ease.ts";
import { typed } from "../../lib/text.ts";
import { Headline } from "../../components/Headline.tsx";
import { Ping } from "../../components/Ping.tsx";
import { SAFE } from "../timeline.ts";
import { rgba, useLayout } from "../kit.tsx";

/** How TarTrak finds you (README, "How it works"): each step and the data it yields. */
const ROWS = [
  { label: "SCREENSHOT", tag: "YOU PRESS THE KEY" },
  { label: "FILENAME", tag: "_-182.40, 2.10, -71.03_…" },
  { label: "COORDINATES", tag: "X -182.4 · Z -71.0" },
  { label: "MAP", tag: "CUSTOMS, FROM THE GAME LOG" },
  { label: "POSITION", tag: "LIVE ON THE MAP" },
] as const;
const CAPTION = "JUST FILES THE GAME ALREADY WRITES";

/** One row: slams in from the left, an amber bar underlines it, and its data tag pops at its end. */
const Row = ({ k, frame, size }: { k: number; frame: number; size: number }) => {
  const at = SAFE.rows[k];
  if (frame < at) return null;
  const inT = prog(frame, at, at + 8, easeOutExpo);
  const markAt = at + SAFE.markAfter;
  const mark = prog(frame, markAt, markAt + 6, easeOutExpo);
  const flash = 1 - prog(frame, at, at + 5);
  const tag = spring({ frame: frame - markAt - 2, fps: 60, config: SPRING_POP });
  // Collapse: rows leave upward one after another, blurring.
  const leave = prog(frame, SAFE.collapse + k * 2, SAFE.collapse + k * 2 + 14, easeInCubic);
  const marked = frame >= markAt;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: size * 0.3,
        height: size * 1.1,
        opacity: inT * (1 - leave),
        transform: `translate(${(1 - inT) * -60}px, ${-leave * 120}px) skewX(${(1 - inT) * -8}deg)`,
        filter: leave > 0 ? `blur(${leave * 10}px)` : undefined,
      }}
    >
      <span style={{ font: `500 ${size * 0.2}px ${MONO}`, color: C.muted, letterSpacing: "0.1em", width: size * 0.45 }}>
        {String(k + 1).padStart(2, "0")}
      </span>
      <span style={{ position: "relative", display: "inline-block" }}>
        <span
          style={{
            font: `700 ${size}px/1 ${COND}`,
            letterSpacing: "-0.01em",
            color: C.fg,
            textShadow: flash > 0 ? `0 0 ${24 * flash}px rgba(255, 255, 255, ${0.8 * flash})` : undefined,
          }}
        >
          {ROWS[k].label}
        </span>
        <span
          style={{
            position: "absolute",
            left: -size * 0.08,
            right: -size * 0.08,
            bottom: -size * 0.1,
            height: size * 0.06,
            background: C.amber,
            boxShadow: `0 0 ${size * 0.15}px ${rgba(C.amber, 0.6)}`,
            transformOrigin: "0% 50%",
            transform: `scaleX(${mark})`,
          }}
        />
      </span>
      {marked ? (
        <span
          style={{
            font: `700 ${size * 0.22}px/1 ${MONO}`,
            letterSpacing: "0.14em",
            color: C.amber,
            whiteSpace: "nowrap",
            padding: `${size * 0.06}px ${size * 0.1}px`,
            border: `2px solid ${C.amber}`,
            borderRadius: size * 0.06,
            transform: `scale(${tag})`,
            opacity: clamp(tag * 2),
          }}
        >
          {ROWS[k].tag}
        </span>
      ) : null}
    </div>
  );
};

/** A check in a ring that draws itself, with a ping. */
const Check = ({ frame, x, y, r }: { frame: number; x: number; y: number; r: number }) => {
  if (frame < SAFE.check) return null;
  const ring = prog(frame, SAFE.check, SAFE.check + 14, easeOutCubic);
  const tick = prog(frame, SAFE.check + 6, SAFE.check + 16, easeOutCubic);
  const leave = prog(frame, SAFE.out, SAFE.out + 10, easeInCubic);
  const circ = 2 * Math.PI * r;
  const tickLen = r * 1.3;
  return (
    <div style={{ position: "absolute", left: 0, top: 0, opacity: 1 - leave }}>
      <svg width={r * 2 + 40} height={r * 2 + 40} style={{ position: "absolute", left: x - r - 20, top: y - r - 20, overflow: "visible" }}>
        <circle
          cx={r + 20}
          cy={r + 20}
          r={r}
          fill={rgba(C.amber, 0.08 * ring)}
          stroke={C.amber}
          strokeWidth={5}
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - ring)}
          transform={`rotate(-90 ${r + 20} ${r + 20})`}
          style={{ filter: `drop-shadow(0 0 12px ${rgba(C.amber, 0.5)})` }}
        />
        <path
          d={`M ${r + 20 - r * 0.42} ${r + 20 + r * 0.02} L ${r + 20 - r * 0.1} ${r + 20 + r * 0.32} L ${r + 20 + r * 0.45} ${r + 20 - r * 0.3}`}
          fill="none"
          stroke={C.amber}
          strokeWidth={7}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={tickLen}
          strokeDashoffset={tickLen * (1 - tick)}
        />
      </svg>
      <Ping at={SAFE.check + 14} cx={x} cy={y} maxR={r * 2.4} dur={36} />
    </div>
  );
};

/**
 * Scene 5, HOW IT WORKS (local 0-359). Five steps from screenshot to map slam in on the beat, each
 * underlined in amber with the data it yields; they collapse upward, and "IT NEVER TOUCHES THE GAME." rises under a check that draws
 * itself, with a caption saying what it does read.
 */
export const Safe = () => {
  const frame = useCurrentFrame();
  const { W, H, portrait } = useLayout();
  const size = portrait ? 84 : 112;
  const rowsLeft = portrait ? 70 : 420;
  const rowsTop = H / 2 - (ROWS.length * size * 1.1) / 2 + (portrait ? 0 : 30);
  const header = typed("// HOW TARTRAK WORKS", prog(frame, 0, 12));
  const headerOut = prog(frame, SAFE.collapse, SAFE.collapse + 10);
  // Each mark throws an amber wash on the edges.
  const lastMark = [...SAFE.rows].reverse().map((r) => r + SAFE.markAfter).find((s) => frame >= s);
  const wash = lastMark === undefined || frame > SAFE.collapse ? 0 : 1 - prog(frame, lastMark, lastMark + 16);
  const hlSize = portrait ? 118 : 170;
  const hlY = portrait ? H / 2 + 150 : H / 2 + 150;
  const caption = typed(CAPTION, prog(frame, SAFE.caption, SAFE.caption + 30));
  const captionOut = prog(frame, SAFE.out, SAFE.out + 10);
  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse farthest-corner at 50% 50%, ${rgba(C.amber, 0)} 45%, ${rgba(C.amber, 0.16 * wash)} 100%)`,
        }}
      />
      {frame < SAFE.collapse + 30 ? (
        <>
          <div
            style={{
              position: "absolute",
              left: rowsLeft,
              top: rowsTop - 70,
              font: `500 ${portrait ? 22 : 20}px ${MONO}`,
              letterSpacing: "0.16em",
              color: C.amber,
              opacity: 1 - headerOut,
            }}
          >
            {header}
          </div>
          <div style={{ position: "absolute", left: rowsLeft, top: rowsTop }}>
            {ROWS.map((_, k) => (
              <Row key={k} k={k} frame={frame} size={size} />
            ))}
          </div>
        </>
      ) : null}
      <Check frame={frame} x={W / 2} y={hlY - hlSize * 1.92 - (portrait ? 110 : 90)} r={portrait ? 62 : 56} />
      <Headline
        lines={[{ text: "IT NEVER TOUCHES", accent: "NEVER" }, { text: "THE GAME." }]}
        at={[...SAFE.headline]}
        out={SAFE.out}
        x={W / 2}
        y={hlY}
        size={hlSize}
        align="center"
      />
      {frame >= SAFE.caption ? (
        <div
          style={{
            position: "absolute",
            left: 0,
            width: W,
            top: hlY + (portrait ? 70 : 64),
            textAlign: "center",
            font: `500 ${portrait ? 24 : 22}px ${MONO}`,
            letterSpacing: "0.14em",
            color: C.fg2,
            opacity: 1 - captionOut,
            padding: "0 60px",
            boxSizing: "border-box",
          }}
        >
          {caption}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

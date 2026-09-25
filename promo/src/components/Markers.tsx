import { useId } from "react";
import { C } from "../theme.ts";
import { clamp } from "../lib/ease.ts";
import { Icon } from "./ui.tsx";

/*
 * Map markers in the app's look (src/lib/map/markers.ts, pins.ts), sized for 1080p. Each one is drawn
 * round its parent's origin: put it inside a positioned element at the point (the pin's tip, the
 * heading line's start and every dot's centre sit exactly there).
 */

const dot = (size: number) => ({ position: "absolute", left: -size / 2, top: -size / 2, width: size, height: size, borderRadius: "50%" }) as const;

/** My marker: an amber dot in a dark ring, with a soft amber glow. */
export const PlayerDot = ({ size = 18, color = C.amber, glow = true }: { size?: number; color?: string; glow?: boolean }) => (
  <div
    style={{
      ...dot(size),
      background: `radial-gradient(circle at 36% 30%, color-mix(in srgb, ${color} 70%, white), ${color} 58%)`,
      boxShadow: [`0 0 0 3px ${C.onAmber}`, ...(glow ? [`0 0 16px 5px color-mix(in srgb, ${color} 45%, transparent)`] : [])].join(", "),
    }}
  />
);

/** A teammate: a dot in their colour in a dark ring. */
export const MateDot = ({ color, size = 16 }: { color: string; size?: number }) => (
  <div
    style={{
      ...dot(size),
      background: `radial-gradient(circle at 36% 30%, color-mix(in srgb, ${color} 72%, white), ${color} 58%)`,
      boxShadow: `0 0 0 2.5px ${C.deep}, 0 0 12px 2px color-mix(in srgb, ${color} 35%, transparent)`,
    }}
  />
);

/**
 * Heading line from the origin, `angle` in compass degrees (0 = up, clockwise), `length` px: dashed,
 * round caps, fading along its length to a faint tip as in the app. `draw` 0..1 grows it out.
 */
export const HeadingLine = ({
  length,
  angle,
  color,
  width,
  dash = "10 14",
  draw = 1,
}: {
  length: number;
  angle: number;
  color: string;
  width: number;
  dash?: string;
  draw?: number;
}) => {
  const id = `heading-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const len = length * clamp(draw);
  if (len <= 0) return null;
  return (
    <svg
      width={length}
      height={width}
      viewBox={`0 ${-width / 2} ${length} ${width}`}
      style={{
        position: "absolute", left: 0, top: -width / 2, overflow: "visible",
        transformOrigin: `0 ${width / 2}px`, transform: `rotate(${angle - 90}deg)`,
      }}
    >
      <defs>
        <linearGradient id={id} gradientUnits="userSpaceOnUse" x1={0} y1={0} x2={length} y2={0}>
          <stop offset={0} stopColor={color} stopOpacity={1} />
          <stop offset={1} stopColor={color} stopOpacity={0.15} />
        </linearGradient>
      </defs>
      {/* The first dash is centred on the origin, so the dot on top hides it and no stub pokes out. */}
      <line
        x1={0}
        y1={0}
        x2={len}
        y2={0}
        stroke={`url(#${id})`}
        strokeWidth={width}
        strokeDasharray={dash}
        strokeDashoffset={parseFloat(dash) / 2}
        strokeLinecap="round"
      />
    </svg>
  );
};

const EXTRACT_COLOR = { pmc: C.extractPmc, scav: C.extractScav, shared: C.extractShared } as const;

/** Extract marker: a rounded square in the extract's colour with a dark exit arrow. */
export const ExtractBadge = ({ kind, size = 26 }: { kind: "pmc" | "scav" | "shared"; size?: number }) => (
  <div
    style={{
      position: "absolute", left: -size / 2, top: -size / 2, width: size, height: size, boxSizing: "border-box",
      borderRadius: size * 0.26, background: EXTRACT_COLOR[kind], color: C.deep,
      display: "grid", placeItems: "center",
      boxShadow: `0 0 0 1.5px ${C.deep}, 0 2px 8px rgba(0, 0, 0, 0.55)`,
    }}
  >
    <Icon name="exit" size={size * 0.62} />
  </div>
);

/** The app's teardrop map pin (a private pin: hollow white ring); `size` is its height, the tip at the origin. */
export const PinGlyph = ({ color, size }: { color: string; size: number }) => {
  const w = size * 0.75;
  return (
    <svg
      viewBox="0 0 24 32"
      width={w}
      height={size}
      style={{ position: "absolute", left: -w / 2, top: (-size * 31) / 32, overflow: "visible", filter: "drop-shadow(0 1px 2px rgba(0, 0, 0, 0.6))" }}
    >
      <path d="M12 31C12 31 2 19 2 11a10 10 0 0 1 20 0c0 8-10 20-10 20z" fill={color} stroke="#000" strokeWidth={1.5} />
      <circle cx={12} cy={11} r={4} fill="none" stroke="#fff" strokeWidth={2} />
    </svg>
  );
};

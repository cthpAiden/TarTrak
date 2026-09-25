import { C } from "../theme.ts";
import { clamp } from "../lib/ease.ts";

/*
 * Proportions of the app icon (src-tauri/icons/icon.png, measured at 512 px), as shares of the ring's
 * outer diameter: ring stroke 0.106; tick 0.075 wide, from 0.595 to 0.238 above the centre (it clears
 * the ring's outer edge by 0.095 and reaches 0.156 inside its inner edge).
 */
const STROKE = 0.106;
const TICK_W = 0.075;
const TICK_TOP = 0.595;
const TICK_BOTTOM = 0.238;

/**
 * The TarTrak mark: an amber ring with one tick at 12 o'clock. The element is `size` px square with the
 * ring's outer edge touching its sides (so its centre is the ring's centre); the tick overhangs the top
 * by 0.095 x size. `ring` 0..1 draws the ring clockwise from 12 o'clock; `tick` scales the tick's length
 * in from the ring (a spring may overshoot past 1); `glow` 0..1 is an amber bloom. `stroke` recolours
 * ring and tick; `strokeWidth` (px) overrides the ring's width, e.g. while it morphs from a thinner ring.
 */
export const LogoMark = ({
  size,
  ring = 1,
  tick = 1,
  glow = 1,
  stroke = C.amber,
  strokeWidth,
}: {
  size: number;
  ring?: number;
  tick?: number;
  glow?: number;
  stroke?: string;
  strokeWidth?: number;
}) => {
  const sw = strokeWidth ?? size * STROKE;
  const c = size / 2;
  const r = c - sw / 2;
  const tw = size * TICK_W;
  const top = c - size * TICK_TOP;
  const bottom = c - size * TICK_BOTTOM;
  const oy = c - r;
  const g = clamp(glow);
  const bloom = (blur: number, pct: number) => `drop-shadow(0 0 ${blur}px color-mix(in srgb, ${stroke} ${pct}%, transparent))`;
  const share = clamp(ring);
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{
        display: "block",
        overflow: "visible",
        filter: g > 0 ? `${bloom(size * 0.03, Math.round(55 * g))} ${bloom(size * 0.12, Math.round(30 * g))}` : undefined,
      }}
      aria-hidden
    >
      {share >= 1 ? (
        <circle cx={c} cy={c} r={r} fill="none" stroke={stroke} strokeWidth={sw} />
      ) : share > 0 ? (
        <path
          d={`M${c} ${oy}A${r} ${r} 0 1 1 ${c} ${c + r}A${r} ${r} 0 1 1 ${c} ${oy}`}
          fill="none"
          stroke={stroke}
          strokeWidth={sw}
          pathLength={1}
          strokeDasharray={`${share} 2`}
        />
      ) : null}
      {tick > 0 ? (
        <rect
          x={c - tw / 2}
          y={top}
          width={tw}
          height={bottom - top}
          fill={stroke}
          transform={`translate(0 ${oy}) scale(1 ${tick}) translate(0 ${-oy})`}
        />
      ) : null}
    </svg>
  );
};

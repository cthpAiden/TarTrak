import { useCurrentFrame } from "remotion";
import { C } from "../theme.ts";
import { easeOutCubic } from "../lib/ease.ts";

/**
 * Sonar ping: a ring round (`cx`, `cy`) growing from 0 to `maxR` (easeOutCubic) while it fades from 1 to 0,
 * with a faint wide halo. Drawn in its positioned parent's coordinates; nothing outside at..at+dur.
 */
export const Ping = ({
  at,
  cx,
  cy,
  maxR,
  color = C.amber,
  dur = 40,
  width = 2,
}: {
  at: number;
  cx: number;
  cy: number;
  maxR: number;
  color?: string;
  dur?: number;
  width?: number;
}) => {
  const frame = useCurrentFrame();
  if (frame < at || frame > at + dur) return null;
  const t = (frame - at) / dur;
  const r = maxR * easeOutCubic(t);
  const o = (1 - t) * (1 - t * 0.35);
  if (r < 0.5 || o <= 0) return null;
  const box = maxR + width * 6;
  return (
    <svg
      width={box * 2}
      height={box * 2}
      viewBox={`${-box} ${-box} ${box * 2} ${box * 2}`}
      style={{ position: "absolute", left: cx - box, top: cy - box, overflow: "visible", pointerEvents: "none" }}
    >
      <circle r={r} fill="none" stroke={color} strokeWidth={width * 7} opacity={o * 0.05} />
      <circle r={r} fill="none" stroke={color} strokeWidth={width * 3} opacity={o * 0.14} />
      <circle r={r} fill="none" stroke={color} strokeWidth={width} opacity={o} />
    </svg>
  );
};

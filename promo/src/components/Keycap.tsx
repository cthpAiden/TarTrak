import { spring, useCurrentFrame } from "remotion";
import { MONO } from "../fonts.ts";
import { C, SPRING_POP } from "../theme.ts";
import { easeInOutCubic, easeOutCubic, prog } from "../lib/ease.ts";

const DEPTH = 14;
const TRAVEL = 10;

/**
 * A 3D keycap centred on (`x`, `y`) (the top face at rest), `size` px square. Springs up from +80 px at
 * `appearAt`, lifts 4 px over the 8 frames before `pressAt`, goes down 10 px at `pressAt` with an amber
 * tint and rim glow, and springs back at `releaseAt` (pass Infinity to hold it down).
 */
export const Keycap = ({
  label,
  sub,
  x,
  y,
  size = 180,
  appearAt,
  pressAt,
  releaseAt,
}: {
  label: string;
  sub?: string;
  x: number;
  y: number;
  size?: number;
  appearAt: number;
  pressAt: number;
  releaseAt: number;
}) => {
  const frame = useCurrentFrame();
  if (frame < appearAt) return null;
  const s = size;
  const radius = s * 0.22;
  const enter = spring({ frame: frame - appearAt, fps: 60, config: SPRING_POP });
  const alpha = prog(frame, appearAt, appearAt + 5);
  // Anticipation: the key rises 4 px, then lands on `pressAt` in one frame, with a 1.5 px jolt of the whole key.
  const hit = frame >= pressAt ? 1 - prog(frame, pressAt, pressAt + 4, easeOutCubic) : 0;
  const lift = frame < pressAt ? -4 * prog(frame, pressAt - 8, pressAt, easeInOutCubic) : 1.5 * hit;
  let press = 0;
  let lit = 0;
  if (frame >= releaseAt) {
    press = 1 - spring({ frame: frame - releaseAt, fps: 60, config: SPRING_POP });
    lit = 1 - prog(frame, releaseAt, releaseAt + 10, easeOutCubic);
  } else if (frame >= pressAt) {
    press = 1 + 0.12 * hit;
    lit = 1;
  }
  // The rim glow flares on impact and settles.
  const glow = lit * (1 + 0.6 * (frame >= pressAt && frame < releaseAt ? 1 - prog(frame, pressAt, pressAt + 10, easeOutCubic) : 0));
  const amber = (a: number) => `rgba(240, 180, 41, ${a})`;
  return (
    <div
      style={{
        position: "absolute",
        left: x - s / 2,
        top: y - s / 2,
        width: s,
        height: s,
        opacity: alpha,
        transform: `translateY(${(1 - enter) * 80 + lift}px)`,
      }}
    >
      {/* amber light spilling on the surface under a pressed key */}
      <div
        style={{
          position: "absolute", left: -s * 0.45, right: -s * 0.45, top: s * 0.35, height: s * 1.1,
          background: `radial-gradient(closest-side, ${amber(Math.min(0.3, 0.2 * glow))}, ${amber(0)})`,
        }}
      />
      {/* body: the side you see under the face; its drop shadow sits on the surface */}
      <div
        style={{
          position: "absolute", left: 0, top: DEPTH, width: s, height: s, borderRadius: radius,
          background: "linear-gradient(180deg, #161b21 0%, #0f1216 60%, #0c0e11 100%)",
          boxShadow: [
            "inset 0 -1px 0 rgba(255, 255, 255, 0.06)",
            "0 2px 2px rgba(0, 0, 0, 0.5)",
            `0 ${s * 0.12}px ${s * 0.22}px rgba(0, 0, 0, 0.55)`,
            `0 ${s * 0.22}px ${s * 0.5}px rgba(0, 0, 0, 0.35)`,
          ].join(", "),
        }}
      />
      {/* top face */}
      <div
        style={{
          position: "absolute", left: 0, top: press * TRAVEL, width: s, height: s, borderRadius: radius,
          background: [
            "radial-gradient(90% 70% at 50% 30%, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0) 70%)",
            "linear-gradient(180deg, #2a303a 0%, #1c2129 100%)",
          ].join(", "),
          boxShadow: [
            "inset 0 1px 0 rgba(255, 255, 255, 0.09)",
            "inset 0 -3px 0 rgba(0, 0, 0, 0.22)",
            "inset 0 0 0 1px rgba(255, 255, 255, 0.035)",
            `inset 0 0 ${s * 0.1}px ${amber(0.3 * lit)}`,
            `0 0 0 1.5px ${amber(0.9 * lit)}`,
            `0 0 ${s * 0.18}px ${amber(Math.min(0.75, 0.45 * glow))}`,
          ].join(", "),
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: s * 0.05,
          overflow: "hidden",
        }}
      >
        {/* Amber tint, about 20%: stronger at the top, as if lit from inside the key. */}
        <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, ${amber(0.27)}, ${amber(0.13)})`, opacity: lit }} />
        <div
          style={{
            position: "relative", fontFamily: MONO, fontWeight: 700, fontSize: s * 0.17, lineHeight: 1,
            letterSpacing: "0.04em", color: C.fg, whiteSpace: "nowrap", textShadow: `0 0 ${s * 0.08}px ${amber(0.5 * lit)}`,
          }}
        >
          {label}
        </div>
        {sub ? (
          <div
            style={{
              position: "relative", fontFamily: MONO, fontWeight: 500, fontSize: 13, lineHeight: 1,
              letterSpacing: "0.16em", textTransform: "uppercase", color: C.muted, whiteSpace: "nowrap",
            }}
          >
            {sub}
          </div>
        ) : null}
      </div>
    </div>
  );
};

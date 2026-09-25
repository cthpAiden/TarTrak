import { spring, useCurrentFrame } from "remotion";
import { MONO } from "../fonts.ts";
import { C, SPRING_POP } from "../theme.ts";
import { easeOutCubic, easeOutExpo, prog } from "../lib/ease.ts";
import { typed } from "../lib/text.ts";
import { Ping } from "./Ping.tsx";

/** The leader's first leg rises at 45° this far (px, each way) before it turns level. */
const ELBOW = 34;
const BOX_H = 34;

/**
 * A callout pointing at `anchor` (in its positioned parent's coordinates): at `at` an amber anchor dot
 * pops with a small ping; the elbow leader (45° up, then `length` px level, towards `side`) draws over
 * at+2..at+12; the label box wipes open at at+10 and its caps text types over at+12..at+20. `speed`
 * divides those leader, box and typing offsets (2 = done by at+10); the dot and ping keep their timing.
 */
export const Callout = ({
  anchor,
  label,
  at,
  side = "right",
  length = 140,
  speed = 1,
}: {
  anchor: { x: number; y: number };
  label: string;
  at: number;
  side?: "left" | "right";
  length?: number;
  speed?: number;
}) => {
  const frame = useCurrentFrame();
  if (frame < at) return null;
  const dir = side === "right" ? 1 : -1;
  const elbow = { x: anchor.x + dir * ELBOW, y: anchor.y - ELBOW };
  const end = { x: elbow.x + dir * length, y: elbow.y };
  const t = (offset: number) => at + offset / speed;
  const pop = spring({ frame: frame - at, fps: 60, config: SPRING_POP });
  const line = prog(frame, t(2), t(12), easeOutCubic);
  const box = prog(frame, t(10), t(15), easeOutExpo);
  const text = label.toUpperCase();
  const shown = typed(text, prog(frame, t(12), t(20)));
  const wipe = `calc(${(1 - box) * 100}% - ${24 * box}px)`;
  return (
    <>
      <Ping at={at} cx={anchor.x} cy={anchor.y} maxR={26} dur={30} width={1.5} />
      <svg width={1} height={1} style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none" }}>
        {line > 0 ? (
          <path
            d={`M${anchor.x} ${anchor.y}L${elbow.x} ${elbow.y}L${end.x} ${end.y}`}
            fill="none"
            stroke="rgba(232, 234, 237, 0.72)"
            strokeWidth={1.5}
            pathLength={1}
            strokeDasharray="1 1"
            strokeDashoffset={1 - line}
          />
        ) : null}
        <circle cx={anchor.x} cy={anchor.y} r={3 * pop + 1.5} fill={C.onAmber} />
        <circle cx={anchor.x} cy={anchor.y} r={3 * pop} fill={C.amber} style={{ filter: "drop-shadow(0 0 4px rgba(240, 180, 41, 0.8))" }} />
      </svg>
      {box > 0 ? (
        <div
          style={{
            position: "absolute",
            left: end.x,
            top: end.y - BOX_H / 2,
            height: BOX_H,
            transform: side === "left" ? "translateX(-100%)" : undefined,
            // Wipes open from the leader's end; the negative insets keep the shadow once it is open.
            clipPath: side === "left" ? `inset(-24px -24px -24px ${wipe})` : `inset(-24px ${wipe} -24px -24px)`,
            boxSizing: "border-box",
            display: "flex",
            alignItems: "center",
            padding: "0 14px 0 12px",
            background: "rgba(11, 13, 16, 0.8)",
            border: `1px solid ${C.line2}`,
            borderLeft: `3px solid ${C.amber}`,
            fontFamily: MONO,
            fontSize: 15,
            fontWeight: 500,
            letterSpacing: "0.1em",
            color: C.fg,
            whiteSpace: "pre",
            boxShadow: "0 6px 18px rgba(0, 0, 0, 0.35)",
          }}
        >
          <span>{shown}</span>
          <span style={{ visibility: "hidden" }}>{text.slice(shown.length)}</span>
        </div>
      ) : null}
    </>
  );
};

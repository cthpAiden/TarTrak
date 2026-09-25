import type { CSSProperties } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { MONO } from "../fonts.ts";
import { C } from "../theme.ts";
import { clamp, easeInOutCubic, easeOutExpo, prog } from "../lib/ease.ts";
import { scramble, typed } from "../lib/text.ts";
import { SHOTS, shotAt, timecode } from "../timeline.ts";

const INSET = 48;
const ARM = 40;
const T = 2;
const INK = "rgba(255, 255, 255, 0.35)";
/** Text rows sit on the bracket arms, starting this far past an arm's end. */
const TEXT_X = INSET + ARM + 18;
const ROW = INSET + T / 2;

type Corner = { right: boolean; bottom: boolean; at: number };
const CORNERS: Corner[] = [
  { right: false, bottom: false, at: 5 },
  { right: true, bottom: false, at: 8 },
  { right: true, bottom: true, at: 11 },
  { right: false, bottom: true, at: 14 },
];

const Bracket = ({ right, bottom, at, frame }: Corner & { frame: number }) => {
  const p = prog(frame, at, at + 11, easeOutExpo);
  if (p <= 0) return null;
  const h: CSSProperties = right ? { right: INSET } : { left: INSET };
  const v: CSSProperties = bottom ? { bottom: INSET } : { top: INSET };
  const vArm: CSSProperties = bottom ? { bottom: INSET + T } : { top: INSET + T };
  return (
    <>
      <div
        style={{
          position: "absolute", ...h, ...v, width: ARM, height: T, background: INK,
          transformOrigin: right ? "100% 50%" : "0% 50%", transform: `scaleX(${p})`,
        }}
      />
      <div
        style={{
          position: "absolute", ...h, ...vArm, width: T, height: ARM - T, background: INK,
          transformOrigin: bottom ? "50% 100%" : "50% 0%", transform: `scaleY(${p})`,
        }}
      />
    </>
  );
};

/** Types `text` in over 12 frames from `at`. */
const typeIn = (text: string, frame: number, at: number) => typed(text, prog(frame, at, at + 12));

/**
 * The thin viewfinder HUD: corner brackets drawing in over f5-25, REC + title top-left, shot counter
 * top-right, running timecode bottom-left, heading bottom-right. Fades out over f720-740.
 */
export const Hud = () => {
  const frame = useCurrentFrame();
  const fade = 1 - prog(frame, 720, 740, easeInOutCubic);
  if (fade <= 0) return null;
  const shot = SHOTS[shotAt(frame)];
  // A new shot's name decodes over 10 frames (shot 1's types in with the rest of the HUD).
  const name = shot.from > 0 && frame < shot.from + 10 ? scramble(shot.name, prog(frame, shot.from, shot.from + 10), frame, 7) : shot.name;
  const count = `${String(shot.index).padStart(2, "0")} / 07`;
  // REC blinks at 1 Hz with 2-frame soft edges.
  const ph = frame % 60;
  const blink = ph < 30 ? clamp(ph / 2 + 0.5) : clamp((32 - ph) / 2);
  const recIn = prog(frame, 12, 16);
  const row: CSSProperties = { position: "absolute", display: "flex", alignItems: "center", gap: 12, height: 20, marginTop: -10, whiteSpace: "pre" };
  return (
    <AbsoluteFill
      style={{
        opacity: fade, pointerEvents: "none", color: INK, fontFamily: MONO, fontSize: 14, fontWeight: 500, lineHeight: "20px",
        letterSpacing: "0.14em", fontVariantNumeric: "tabular-nums",
      }}
    >
      {CORNERS.map((c, i) => (
        <Bracket key={i} {...c} frame={frame} />
      ))}
      <div style={{ ...row, left: TEXT_X, top: ROW }}>
        <span
          style={{
            width: 7, height: 7, borderRadius: "50%", background: C.amber, opacity: blink * recIn,
            boxShadow: "0 0 8px rgba(240, 180, 41, 0.7)",
          }}
        />
        <span>{typeIn("REC", frame, 13)}</span>
        <span style={{ marginLeft: 8 }}>{typeIn("TARTRAK // SHOWREEL", frame, 15)}</span>
      </div>
      <div style={{ ...row, right: TEXT_X, top: ROW }}>
        <span>{typeIn(count, frame, 17)}</span>
        <span style={{ marginLeft: 8 }}>{typeIn(name, frame, 19)}</span>
      </div>
      <div style={{ ...row, left: TEXT_X, top: 1080 - ROW }}>{typeIn(timecode(frame), frame, 21)}</div>
      <div style={{ ...row, right: TEXT_X, top: 1080 - ROW }}>{typeIn("HDG 048°", frame, 23)}</div>
    </AbsoluteFill>
  );
};

import { AbsoluteFill, useCurrentFrame } from "remotion";
import { MONO } from "../../fonts.ts";
import { C } from "../../theme.ts";
import { easeInOutCubic, easeOutCubic, lerp, prog } from "../../lib/ease.ts";
import { Headline } from "../../components/Headline.tsx";
import { Icon } from "../../components/ui.tsx";
import { CLOCK } from "../timeline.ts";
import { mixHex, rgba, useLayout } from "../kit.tsx";

/** Raid length the ring is drawn against, and the time-lapse's start and end (seconds left). */
const RAID = 45 * 60;
const START = 41 * 60 + 52;
const RED_AT = 5 * 60;

/** Seconds left: a time-lapse from 41:52 down to 05:00, then real seconds, one per beat. */
function secondsLeft(frame: number): number {
  if (frame < CLOCK.red) return Math.round(lerp(START, RED_AT, easeInOutCubic(prog(frame, CLOCK.lapse[0], CLOCK.lapse[1]))));
  return RED_AT - 1 - Math.floor((frame - CLOCK.red) / 30);
}
const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

/**
 * Scene 8, RAID CLOCK (local 0-239). A ring of minute ticks round a big mono countdown that time-lapses
 * from 41:52 to 05:00, then turns red and ticks real seconds on the beat; "WATCH THE CLOCK." beside it
 * and the app's clock chip under it.
 */
export const Clock = () => {
  const frame = useCurrentFrame();
  const { W, H, portrait } = useLayout();
  const s = secondsLeft(frame);
  const red = frame >= CLOCK.red;
  const speed = frame < CLOCK.red ? Math.abs(secondsLeft(frame + 1) - s) : 0;
  const beat = red ? 1 - prog(frame, CLOCK.red + Math.floor((frame - CLOCK.red) / 30) * 30, CLOCK.red + Math.floor((frame - CLOCK.red) / 30) * 30 + 14) : 0;
  const col = red ? mixHex(C.north, "#ffffff", beat * 0.35) : C.amber;
  const enter = easeOutCubic(prog(frame, 0, 18));
  const leave = prog(frame, CLOCK.out, CLOCK.out + 14, easeOutCubic);

  const cx = portrait ? W / 2 : 1370;
  const cy = portrait ? H * 0.38 : H / 2;
  const r = portrait ? 400 : 310;
  const digit = portrait ? 210 : 176;
  const circ = 2 * Math.PI * r;
  const share = s / RAID;
  const ticks = Array.from({ length: 60 }, (_, i) => {
    const a = (i / 60) * Math.PI * 2 - Math.PI / 2;
    const major = i % 5 === 0;
    const r0 = r + 22, r1 = r + (major ? 46 : 34);
    // Ticks light up as the hand of the remaining time passes them.
    const lit = i / 60 <= share;
    return (
      <line
        key={i}
        x1={cx + Math.cos(a) * r0}
        y1={cy + Math.sin(a) * r0}
        x2={cx + Math.cos(a) * r1}
        y2={cy + Math.sin(a) * r1}
        stroke={lit ? rgba(red ? C.north : C.amber, major ? 0.9 : 0.6) : rgba(C.fg, major ? 0.3 : 0.14)}
        strokeWidth={major ? 4 : 2}
        strokeLinecap="round"
      />
    );
  });
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: `radial-gradient(circle at ${cx}px ${cy}px, ${rgba(red ? C.north : C.amber, 0.12 + 0.1 * beat)} 0%, rgba(0,0,0,0) ${r * 1.6}px)` }} />
      <AbsoluteFill style={{ opacity: enter * (1 - leave), transform: `scale(${lerp(0.92, 1, enter) + leave * 0.08})`, transformOrigin: `${cx}px ${cy}px` }}>
        <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0 }}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={rgba(C.fg, 0.08)} strokeWidth={10} />
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={col}
            strokeWidth={10}
            strokeLinecap="round"
            strokeDasharray={`${circ * share} ${circ}`}
            transform={`rotate(-90 ${cx} ${cy})`}
            style={{ filter: `drop-shadow(0 0 14px ${rgba(red ? C.north : C.amber, 0.55)})` }}
          />
          {ticks}
        </svg>
        <div
          style={{
            position: "absolute",
            left: cx - r,
            width: 2 * r,
            top: cy - digit * 0.62,
            textAlign: "center",
            font: `700 ${digit}px/1 ${MONO}`,
            fontVariantNumeric: "tabular-nums",
            letterSpacing: "-0.03em",
            color: col,
            textShadow: speed > 2 ? `0 -12px 0 ${rgba(C.amber, 0.18)}, 0 12px 0 ${rgba(C.amber, 0.18)}` : `0 0 ${30 + 30 * beat}px ${rgba(red ? C.north : C.amber, 0.45)}`,
            transform: red ? `scale(${1 + 0.04 * beat})` : undefined,
          }}
        >
          {mmss(s)}
        </div>
        <div
          style={{
            position: "absolute",
            left: cx - r,
            width: 2 * r,
            top: cy + digit * 0.5,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 12,
              height: 52,
              padding: "0 22px",
              borderRadius: 26,
              background: "rgba(15, 19, 24, 0.86)",
              border: `1px solid ${red ? rgba(C.north, 0.7) : C.line2}`,
              font: `600 22px ${MONO}`,
              letterSpacing: "0.14em",
              color: red ? C.north : C.fg2,
            }}
          >
            <Icon name="clock" size={24} />
            RAID TIME LEFT
          </div>
        </div>
      </AbsoluteFill>
      <Headline
        lines={[{ text: "WATCH THE" }, { text: "CLOCK.", accent: "CLOCK." }]}
        at={[...CLOCK.headline]}
        out={CLOCK.out}
        x={portrait ? 80 : 130}
        y={portrait ? H - 250 : H / 2 + 120}
        size={portrait ? 150 : 160}
      />
    </AbsoluteFill>
  );
};

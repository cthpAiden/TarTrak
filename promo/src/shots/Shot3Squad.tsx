import { AbsoluteFill, spring, useCurrentFrame } from "remotion";
import { C, SPRING_POP } from "../theme.ts";
import { MONO } from "../fonts.ts";
import { easeInCubic, easeInExpo, easeOutCubic, easeOutExpo, lerp, prog } from "../lib/ease.ts";
import { scramble } from "../lib/text.ts";
import { Headline } from "../components/Headline.tsx";
import { project, project3d } from "../world/camera.ts";
import { MATES, type Mate } from "../world/data.ts";
import { ROOM_CODE, ROOM_LOCKS } from "./mapCam.ts";
import { Blurred, MapWorld, Scrim, groundRing, mapCamAt } from "./Shot2Map.tsx";

const W = 1920;
const H = 1080;
const rgbOf = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const rgba = (hex: string, a: number) => `rgba(${rgbOf(hex).join(", ")}, ${a})`;
const mixHex = (a: string, b: string, t: number) => {
  const A = rgbOf(a), B = rgbOf(b);
  return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(", ")})`;
};

// ---- room code -------------------------------------------------------------------------------------

const BOX_W = 64;
const BOX_H = 78;
const GAP = 10;
const PANEL_W = ROOM_CODE.length * BOX_W + (ROOM_CODE.length - 1) * GAP;
/** Reel glyph of box k in time slot n (a new glyph every 2 frames). */
const reel = (k: number, n: number) => scramble(ROOM_CODE, 0, n * 2, 11)[k];

const glyphStyle = {
  position: "absolute",
  left: 0,
  width: BOX_W,
  height: BOX_H,
  lineHeight: `${BOX_H}px`,
  textAlign: "center",
} as const;

/** One slot: a reel rolling down until its lock, then the real character drops in hot and cools to white. */
const CodeBox = ({ k, frame }: { k: number; frame: number }) => {
  const lock = ROOM_LOCKS[k];
  const age = frame - lock;
  // the border flashes amber for 6 frames from the lock
  const flash = age < 0 ? 0 : age < 2 ? 1 : 1 - prog(age, 2, 6);
  let glyphs;
  if (age < 0) {
    const n = Math.floor(frame / 2), half = frame % 2;
    const smear = `0 -10px 0 ${rgba(C.fg, 0.12)}, 0 10px 0 ${rgba(C.fg, 0.12)}`;
    glyphs = [
      <div key="a" style={{ ...glyphStyle, top: half * BOX_H * 0.5, color: rgba(C.fg, 0.5), textShadow: smear }}>{reel(k, n)}</div>,
      half ? <div key="b" style={{ ...glyphStyle, top: -BOX_H * 0.5, color: rgba(C.fg, 0.5), textShadow: smear }}>{reel(k, n + 1)}</div> : null,
    ];
  } else {
    const drop = spring({ frame: age, fps: 60, config: SPRING_POP });
    const heat = 1 - prog(age, 0, 10, easeOutCubic);
    glyphs = (
      <div
        style={{
          ...glyphStyle,
          top: -BOX_H * 0.55 * (1 - drop),
          color: mixHex(C.fg, C.amber, heat),
          textShadow: heat > 0 ? `0 0 ${14 * heat}px ${rgba(C.amber, 0.7 * heat)}` : undefined,
        }}
      >
        {ROOM_CODE[k]}
      </div>
    );
  }
  return (
    <div
      style={{
        position: "relative",
        width: BOX_W,
        height: BOX_H,
        overflow: "hidden",
        borderRadius: 8,
        border: `1px solid ${flash > 0 ? mixHex(C.line2, C.amber, flash) : C.line2}`,
        background: `linear-gradient(to bottom, ${rgba(C.fg, 0.04)}, ${rgba(C.fg, 0)} 40%), ${rgba(C.deep, 0.84)}`,
        boxShadow: `inset 0 12px 12px -10px ${rgba(C.deep, 0.8)}, inset 0 -12px 12px -10px ${rgba(C.deep, 0.8)}, 0 6px 18px ${rgba(C.deep, 0.45)}${flash > 0 ? `, 0 0 ${18 * flash}px ${rgba(C.amber, 0.45 * flash)}` : ""}`,
        font: `700 52px ${MONO}`,
      }}
    >
      {glyphs}
    </div>
  );
};

/** "ROOM" over six slots, top centre; slides in over f240-248, leaves over f330-340. */
const RoomCode = ({ frame }: { frame: number }) => {
  const enter = prog(frame, 240, 248, easeOutExpo);
  const exit = prog(frame, 330, 340, easeInExpo);
  if (frame < 240 || exit >= 1) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: 960 - PANEL_W / 2,
        top: 90,
        width: PANEL_W,
        transform: `translateY(${-40 * (1 - enter) - 40 * exit}px)`,
        opacity: prog(frame, 240, 245) * (1 - exit),
      }}
    >
      <div style={{ textAlign: "center", font: `500 16px ${MONO}`, lineHeight: "16px", letterSpacing: "0.3em", paddingLeft: "0.3em", color: C.muted }}>ROOM</div>
      <div style={{ display: "flex", gap: GAP, marginTop: 12 }}>
        {Array.from(ROOM_CODE, (_, k) => (
          <CodeBox key={k} k={k} frame={frame} />
        ))}
      </div>
    </div>
  );
};

// ---- the drops -------------------------------------------------------------------------------------

/**
 * Anticipation and impact round the World's own drop (the falling dot is only on screen for its last frames):
 * from the fall whoosh a beam of the teammate's colour stands on the landing spot and a dashed reticle closes on
 * it; on landing the beam flares and a wide shockwave runs out over the ground.
 */
const Drop = ({ m, frame }: { m: Mate; frame: number }) => {
  const L = m.landAt;
  if (frame < L - 18 || frame > L + 24) return null;
  const cam = mapCamAt(frame);
  const g = project(cam, m, W, H);
  // the vertical above the landing spot, on screen: through a point just above it, run out past the top edge
  // (a point high above a near spot would fall behind the camera and flip)
  const up = project3d(cam, m, 40, W, H);
  const len = Math.hypot(up.x - g.x, up.y - g.y) || 1;
  const reach = (g.y + 80) / Math.max(0.2, (g.y - up.y) / len);
  const top = { x: g.x + ((up.x - g.x) / len) * reach, y: g.y + ((up.y - g.y) / len) * reach };
  const id = `s3-beam-${m.id}`;
  const beam = frame < L ? 0.55 * prog(frame, L - 18, L - 10, easeOutCubic) + 0.45 * prog(frame, L - 4, L) : 1 - prog(frame, L, L + 7, easeOutCubic);
  const close = prog(frame, L - 18, L, easeInCubic);
  const ret = frame < L ? prog(frame, L - 18, L - 12) : 0;
  const u = prog(frame, L, L + 20);
  return (
    <g>
      <defs>
        <linearGradient id={id} gradientUnits="userSpaceOnUse" x1={g.x} y1={g.y} x2={top.x} y2={top.y}>
          <stop offset={0} stopColor={m.color} stopOpacity={1} />
          <stop offset={0.5} stopColor={m.color} stopOpacity={0.35} />
          <stop offset={1} stopColor={m.color} stopOpacity={0} />
        </linearGradient>
      </defs>
      {beam > 0.01 && (
        <g opacity={beam}>
          <line x1={g.x} y1={g.y} x2={top.x} y2={top.y} stroke={`url(#${id})`} strokeWidth={9} strokeOpacity={0.18} />
          <line x1={g.x} y1={g.y} x2={top.x} y2={top.y} stroke={`url(#${id})`} strokeWidth={1.6} />
        </g>
      )}
      {ret > 0.01 && (
        <path
          d={groundRing(cam, m, lerp(90, 24, close))}
          fill="none"
          stroke={m.color}
          strokeWidth={1.6}
          strokeOpacity={0.9 * ret}
          strokeDasharray="7 7"
          strokeDashoffset={-frame * 1.5}
        />
      )}
      {u > 0 && u < 1 && (
        <g fill="none" stroke={m.color}>
          <path d={groundRing(cam, m, lerp(26, 190, easeOutCubic(u)))} strokeWidth={9} strokeOpacity={0.12 * (1 - u)} />
          <path d={groundRing(cam, m, lerp(26, 190, easeOutCubic(u)))} strokeWidth={2} strokeOpacity={0.75 * (1 - u) * (1 - u)} />
        </g>
      )}
    </g>
  );
};

/**
 * Shot 3, SQUAD (f240-359). The whip lands on the squad's ground under motion blur, the room code rolls in, three
 * teammates drop in on the beats (270, 285, 300), measure lines count out, "SO IS / YOUR SQUAD.", then the camera
 * flattens to shot 4's top-down framing while the buildings sink.
 */
export const Shot3Squad = () => {
  const frame = useCurrentFrame();
  const scrim = prog(frame, 268, 286) * (1 - prog(frame, 330, 345));
  return (
    <AbsoluteFill>
      <Blurred from={240} to={256}>
        <MapWorld show={{ measures: true }} />
      </Blurred>
      <svg width={W} height={H} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {MATES.map((m) => (
          <Drop key={m.id} m={m} frame={frame} />
        ))}
      </svg>
      <Scrim opacity={scrim} />
      <RoomCode frame={frame} />
      <Headline
        lines={[{ text: "SO IS" }, { text: "YOUR SQUAD.", accent: "SQUAD." }]}
        at={[270, 300]}
        out={332}
        x={120}
        y={960}
        size={150}
      />
    </AbsoluteFill>
  );
};

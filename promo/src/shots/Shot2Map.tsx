import type { ReactNode } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { CameraMotionBlur } from "@remotion/motion-blur";
import { C } from "../theme.ts";
import { MONO } from "../fonts.ts";
import { easeInExpo, easeInOutQuint, easeOutCubic, easeOutExpo, prog } from "../lib/ease.ts";
import { scramble, typed } from "../lib/text.ts";
import { Headline } from "../components/Headline.tsx";
import { Ping } from "../components/Ping.tsx";
import { World, type WorldShow } from "../world/World.tsx";
import { camAt, project, type Cam } from "../world/camera.ts";
import { ME, type Pt } from "../world/data.ts";
import { MAP_CAM, landingBump } from "./mapCam.ts";

const W = 1920;
const H = 1080;
const amber = (a: number) => `rgba(240, 180, 41, ${a})`;
const deep = (a: number) => `rgba(11, 13, 16, ${a})`;

/** The camera of shots 2-3 at `frame`, with the landing bumps of shot 3 on top. */
export function mapCamAt(frame: number): Cam {
  const cam = camAt(frame, MAP_CAM);
  const b = landingBump(frame);
  return b === 0 ? cam : { ...cam, zoom: cam.zoom * (1 + 0.018 * b), tilt: cam.tilt + 0.6 * b };
}

/**
 * The world through MAP_CAM. Reads the frame itself, so inside CameraMotionBlur every sub-frame sample gets its
 * own camera. Buildings flatten with the camera over f330-359.
 */
export const MapWorld = ({ show }: { show?: WorldShow }) => {
  const frame = useCurrentFrame();
  const extrude = 1 - prog(frame, 330, 359, easeInOutQuint);
  return <World cam={mapCamAt(frame)} width={W} height={H} show={show} extrude={extrude} />;
};

/** Motion blur only inside [from, to]; outside it the world renders once. */
export const Blurred = ({ from, to, children }: { from: number; to: number; children: ReactNode }) => {
  const frame = useCurrentFrame();
  return frame >= from && frame <= to ? (
    <CameraMotionBlur samples={8} shutterAngle={180}>
      {children}
    </CameraMotionBlur>
  ) : (
    <AbsoluteFill>{children}</AbsoluteFill>
  );
};

/** Bottom-left scrim behind a headline: dark at the bottom edge, gone by its top and right edges. */
export const Scrim = ({ opacity }: { opacity: number }) =>
  opacity <= 0 ? null : (
    <div
      style={{
        position: "absolute",
        left: 0,
        bottom: 0,
        width: 1100,
        height: 470,
        opacity,
        background: `linear-gradient(to top, ${deep(0.75)} 0%, ${deep(0.5)} 45%, ${deep(0)} 100%)`,
        WebkitMaskImage: "linear-gradient(to right, #000 0%, #000 52%, transparent 100%)",
        maskImage: "linear-gradient(to right, #000 0%, #000 52%, transparent 100%)",
        pointerEvents: "none",
      }}
    />
  );

/** A ring on the ground round `c` (world units), as a screen-space path. */
export function groundRing(cam: Cam, c: Pt, r: number): string {
  let d = "";
  for (let a = 0; a <= 360; a += 6) {
    const t = (a * Math.PI) / 180;
    const p = project(cam, { x: c.x + r * Math.cos(t), y: c.y + r * Math.sin(t) }, W, H);
    d += `${a ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  }
  return `${d}Z`;
}

// ---- the hit (f120) ------------------------------------------------------------------------------

/** Echoes of the sonar ping (its ping-pong delay is 0.375 s = 22.5 frames): fainter ground rings from me. */
const ECHOES = [
  { at: 142, r: 520, o: 0.55 },
  { at: 165, r: 640, o: 0.3 },
];

/** The point from shot 1 detonates: flash, bloom, crosshair hairlines, screen ping, echo rings, a position tag. */
const Hit = ({ frame }: { frame: number }) => {
  if (frame < 120 || frame > 195) return null;
  const cam = mapCamAt(frame);
  const me = project(cam, ME, W, H);
  const t = frame - 120;
  const flash = t < 12 ? Math.exp(-t / 2.4) : 0;
  // shot 1's flare streaks (about 230 px at f119) shoot out to the frame edges on the hit
  const hair = (0.25 + 0.75 * prog(frame, 120, 123, easeOutExpo)) * (1 - prog(frame, 121, 140, easeOutCubic));
  // the position tag decodes next to the marker, then steps aside for the headline
  const tagP = prog(frame, 123, 135);
  const tagO = prog(frame, 122, 125) * (1 - prog(frame, 150, 158));
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {flash > 0.01 && (
        <>
          {/* wide halo */}
          <div
            style={{
              position: "absolute",
              left: me.x - 520,
              top: me.y - 520,
              width: 1040,
              height: 1040,
              borderRadius: "50%",
              opacity: 0.55 * flash,
              background: `radial-gradient(closest-side, ${amber(0.5)} 0%, ${amber(0.14)} 30%, ${amber(0)} 100%)`,
              mixBlendMode: "screen",
            }}
          />
          {/* white-hot core */}
          <div
            style={{
              position: "absolute",
              left: me.x - 110,
              top: me.y - 110,
              width: 220,
              height: 220,
              borderRadius: "50%",
              opacity: flash,
              background: `radial-gradient(closest-side, ${C.fg} 0%, ${C.fg} 14%, ${amber(0.85)} 30%, ${amber(0.22)} 62%, ${amber(0)} 100%)`,
              transform: `scale(${0.35 + 0.65 * flash})`,
              mixBlendMode: "screen",
            }}
          />
        </>
      )}
      {hair > 0.01 && (
        <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
          <defs>
            <linearGradient id="s2-hair-h" x1="0" x2="1">
              <stop offset="0" stopColor={C.amber} stopOpacity={0} />
              <stop offset="0.5" stopColor={C.fg} stopOpacity={1} />
              <stop offset="1" stopColor={C.amber} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="s2-hair-v" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={C.amber} stopOpacity={0} />
              <stop offset="0.5" stopColor={C.fg} stopOpacity={1} />
              <stop offset="1" stopColor={C.amber} stopOpacity={0} />
            </linearGradient>
          </defs>
          <rect x={me.x - 960 * hair} y={me.y - 0.75} width={1920 * hair} height={1.5} fill="url(#s2-hair-h)" opacity={hair} />
          <rect x={me.x - 0.75} y={me.y - 560 * hair} width={1.5} height={1120 * hair} fill="url(#s2-hair-v)" opacity={hair * 0.85} />
        </svg>
      )}
      {/* screen-space, so it lives only while the camera is still near top-down */}
      <Ping at={120} cx={960} cy={540} maxR={700} width={3} dur={22} />
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        {ECHOES.map((e) => {
          const u = prog(frame, e.at, e.at + 30);
          if (u <= 0 || u >= 1) return null;
          return <path key={e.at} d={groundRing(cam, ME, e.r * easeOutCubic(u))} fill="none" stroke={C.amber} strokeWidth={1.5} strokeOpacity={e.o * (1 - u)} />;
        })}
      </svg>
      {tagO > 0 && (
        <div
          style={{
            position: "absolute",
            left: me.x + 22,
            top: me.y + 16,
            opacity: tagO,
            padding: "4px 9px",
            borderRadius: 4,
            background: deep(0.74),
            border: `1px solid ${amber(0.45)}`,
            font: `500 13px ${MONO}`,
            letterSpacing: "0.06em",
            lineHeight: "16px",
            color: C.fg,
            whiteSpace: "pre",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {scramble("X -182.4  Z -71.0  HDG 048°", tagP, frame, 5)}
        </div>
      )}
    </AbsoluteFill>
  );
};

// ---- text -----------------------------------------------------------------------------------------

const SUB = "POSITION + HEADING, STRAIGHT FROM YOUR SCREENSHOT";

/** Mono sub-line under the headline: typed over 20 frames from f190, leaves upward with the headline. */
const SubLine = ({ frame }: { frame: number }) => {
  const p = prog(frame, 190, 210);
  const leave = prog(frame, 224, 232, easeInExpo);
  if (p <= 0 || leave >= 1) return null;
  const text = typed(SUB, p);
  return (
    <div style={{ position: "absolute", left: 120, top: 982, height: 26, overflow: "hidden", pointerEvents: "none" }}>
      <div
        style={{
          transform: `translateY(${-26 * leave}px)`,
          font: `500 20px ${MONO}`,
          lineHeight: "26px",
          letterSpacing: "0.12em",
          color: C.fg2,
          whiteSpace: "pre",
          textShadow: `0 1px 2px ${deep(0.6)}`,
        }}
      >
        {text}
        {p < 1 && <span style={{ display: "inline-block", width: 10, height: 18, marginLeft: 3, verticalAlign: "-2px", background: C.amber }} />}
      </div>
    </div>
  );
};

/**
 * Shot 2, ON THE MAP (f120-239). The point from shot 1 detonates into my marker; the camera is blown back and
 * swings up over the map as the sonar ring reveals it; extracts pop on the 8ths; "YOU'RE ON / THE MAP."; from
 * f224 the whip orbit starts under motion blur.
 */
export const Shot2Map = () => {
  const frame = useCurrentFrame();
  const scrim = prog(frame, 148, 166) * (1 - prog(frame, 224, 238));
  return (
    <AbsoluteFill>
      <Blurred from={224} to={239}>
        <MapWorld />
      </Blurred>
      <Hit frame={frame} />
      <Scrim opacity={scrim} />
      <Headline
        lines={[{ text: "YOU'RE ON" }, { text: "THE MAP.", accent: "MAP." }]}
        at={[150, 180]}
        out={222}
        x={120}
        y={960}
        size={150}
      />
      <SubLine frame={frame} />
    </AbsoluteFill>
  );
};

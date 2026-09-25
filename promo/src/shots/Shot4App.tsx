import type { ReactNode } from "react";
import { AbsoluteFill, Freeze, useCurrentFrame } from "remotion";
import { CameraMotionBlur } from "@remotion/motion-blur";
import { Callout } from "../components/Callout.tsx";
import { easeInCubic, prog } from "../lib/ease.ts";
import { AppWindow } from "./app/AppWindow.tsx";
import {
  BLUR_FROM, CALLOUT_AT, CALLOUT_OUT, NOMAD, NORTH_GATE, PERSP, PUSH, WIN_H, WIN_W,
  floatPose, headingPoint, lift, liftedAnchor, pose, projectWin, statusTop, worldToWin,
} from "./app/motion.ts";

/** Callouts at their designed on-screen size: the layer counter-scales the window (held once the push starts). */
const calloutScale = (frame: number) => 1 / (frame <= PUSH.from ? pose(frame) : floatPose(PUSH.from)).s;

/** How far in front of the window the callouts float (px). */
const CALLOUT_Z = 40;

/**
 * The four callouts, in the window's 3D space 40 px in front of it. Anchors are window px: the right end of
 * NOMAD's name pill (from the dot, the rising leader would cross the pill), a point on my heading line,
 * NORTH GATE, the raid clock. Each anchor is solved so its dot, though it floats in front, sits on its target.
 */
const Callouts = () => {
  const frame = useCurrentFrame();
  if (frame < CALLOUT_AT.squad || frame >= CALLOUT_OUT[1]) return null;
  const c = calloutScale(frame);
  const o = pose(frame);
  const at = (p: { x: number; y: number }) => {
    const q = liftedAnchor(p, o, CALLOUT_Z);
    return { x: q.x / c, y: q.y / c };
  };
  const nomad = worldToWin(NOMAD, frame);
  // 74% out: on the line's visible dashes, the elbow below VEX's "132 m" pill, the box clear of GHOST's name
  const heading = worldToWin(headingPoint(0.74), frame);
  const gate = worldToWin(NORTH_GATE, frame);
  // the clock's digits in the status bar's flex row (measured on the stills), mid-height of the 30 px bar
  const clock = { x: 431, y: statusTop(frame) + 15 };
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: WIN_W,
        height: WIN_H,
        transformOrigin: "0 0",
        transform: `translateZ(${CALLOUT_Z}px) scale(${c})`,
        opacity: 1 - easeInCubic(prog(frame, CALLOUT_OUT[0], CALLOUT_OUT[1])),
      }}
    >
      <Callout anchor={at({ x: nomad.x + 52, y: nomad.y - 28 })} label="Live squad positions" at={CALLOUT_AT.squad} side="right" length={60} />
      {/* leftwards and long, so the box clears GHOST's name just below it */}
      <Callout anchor={at(heading)} label="Heading lines" at={CALLOUT_AT.heading} side="left" length={150} />
      <Callout anchor={at(gate)} label="Extracts & quests" at={CALLOUT_AT.extracts} side="left" length={60} />
      <Callout anchor={at(clock)} label="Raid clock" at={CALLOUT_AT.clock} side="right" length={90} />
    </div>
  );
};

const Stage = () => {
  const frame = useCurrentFrame();
  const o = pose(frame);
  const L = lift(frame);
  const flat = o.rx === 0 && o.ry === 0;
  const push = prog(frame, PUSH.from, PUSH.from + 12);
  const radius = 14 * L;
  const centre = projectWin({ x: WIN_W / 2, y: WIN_H / 2 }, o);
  // a flat window gets a plain 2D transform, so Chrome rasters it at its real scale during the push
  const transform = flat
    ? `translate(${o.tx}px, ${o.ty}px) scale(${o.s})`
    : `translate3d(${o.tx}px, ${o.ty}px, 0px) rotateX(${o.rx}deg) rotateY(${o.ry}deg) scale(${o.s})`;
  const reflect = 0.12 * L * (1 - push);
  return (
    <AbsoluteFill style={{ perspective: flat ? undefined : `${PERSP}px`, perspectiveOrigin: `${WIN_W / 2}px ${WIN_H / 2}px` }}>
      {/* amber glow behind the floating window */}
      {L > 0 && push < 1 && (
        <div
          style={{
            position: "absolute",
            left: centre.x - 1300,
            top: centre.y - 850,
            width: 2600,
            height: 1700,
            // full strength under the window, a warm halo just outside its edges
            background: "radial-gradient(closest-side, rgba(240, 180, 41, 0.1) 45%, rgba(240, 180, 41, 0.05) 70%, rgba(240, 180, 41, 0) 100%)",
            opacity: L * (1 - push),
          }}
        />
      )}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: WIN_W,
          height: WIN_H,
          transformOrigin: `${WIN_W / 2}px ${WIN_H / 2}px`,
          transform,
          transformStyle: flat ? undefined : "preserve-3d",
        }}
      >
        {L > 0 && push < 1 && (
          <div style={{ position: "absolute", inset: 0, borderRadius: radius, boxShadow: `0 60px 120px rgba(0, 0, 0, ${0.6 * L * (1 - push)})` }} />
        )}
        <div
          style={{
            position: "absolute",
            inset: 0,
            overflow: "hidden",
            borderRadius: radius,
            WebkitBoxReflect: reflect > 0 ? `below 20px linear-gradient(to bottom, transparent 74%, rgba(255, 255, 255, ${reflect}))` : undefined,
          }}
        >
          <AppWindow />
          {L > 0 && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: radius,
                border: `1px solid rgba(255, 255, 255, ${0.09 * L})`,
                boxShadow: `inset 0 1px 0 rgba(255, 255, 255, ${0.06 * L})`,
                pointerEvents: "none",
              }}
            />
          )}
        </div>
        {!flat && <Callouts />}
      </div>
    </AbsoluteFill>
  );
};

const SAMPLES = 8;
/** The shutter opens from 90 to 180 degrees over the first 4 blurred frames, so the blur builds with the speed. */
const shutterAt = (frame: number) => 90 + 90 * prog(frame, BLUR_FROM, BLUR_FROM + 4);
/**
 * CameraMotionBlur samples ahead of the frame (at f + 1 - k/n x shutter share, k = 1..n). This shifts its
 * samples back so the shutter is centred on the frame, and the first blurred frame does not jump ahead.
 */
const Centred = ({ shutter, children }: { shutter: number; children: ReactNode }) => {
  const frame = useCurrentFrame();
  const shift = -(1 - ((shutter / 360) * (SAMPLES + 1)) / (2 * SAMPLES));
  return <Freeze frame={frame + shift}>{children}</Freeze>;
};

/**
 * Shot 4, THE APP (f360-479): TarTrak's window builds itself round the top-down map (rail, Squad panel,
 * toolbar, status bar), lifts into 3D with callouts, then pushes into the toolbar's route button.
 */
export const Shot4App = () => {
  const frame = useCurrentFrame();
  if (frame < BLUR_FROM) return <Stage />;
  const shutter = shutterAt(frame);
  return (
    <CameraMotionBlur samples={SAMPLES} shutterAngle={shutter}>
      <Centred shutter={shutter}>
        <Stage />
      </Centred>
    </CameraMotionBlur>
  );
};

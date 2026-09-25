import { AbsoluteFill, Freeze, useCurrentFrame } from "remotion";
import { CameraMotionBlur } from "@remotion/motion-blur";
import { Headline } from "../components/Headline.tsx";
import { C } from "../theme.ts";
import { easeOutCubic, prog } from "../lib/ease.ts";
import { HANDOFF } from "../timeline.ts";
import { GameBackdrop } from "./overlay/GameBackdrop.tsx";
import { Minimap } from "./overlay/Minimap.tsx";
import { PUSH, ringSpeed, stageAt, stageTransform } from "./overlay/shot6.ts";

/** The game view fades up as the camera pulls back and down to 12% over the push-in, so the cut to the end card is dark. */
const backdropAt = (frame: number): number =>
  frame < PUSH.from ? prog(frame, 628, 656, easeOutCubic) : 1 - 0.88 * prog(frame, PUSH.from, PUSH.to);

/** Motion blur only where the push-in is fast; its shutter (180°) is centred on the frame, and 719 is left sharp for the hand-off. */
const BLUR = { from: 709, samples: 8, shutter: 180 } as const;

/**
 * One stage: the game view and the minimap at its natural place, zoomed and panned by the shot's camera.
 * `soften` (inside the motion blur) blurs each sample by about half the gap between samples, so thin
 * ticks and text join into one streak instead of strobing as the push-in reaches ~190 px a frame.
 */
const Stage = ({ soften = false }: { soften?: boolean }) => {
  const frame = useCurrentFrame();
  const bd = backdropAt(frame);
  const gap = (ringSpeed(frame) * (BLUR.shutter / 360)) / BLUR.samples;
  const sigma = soften ? 0.5 * gap : 0;
  return (
    <AbsoluteFill style={sigma > 0.3 ? { filter: `blur(${sigma.toFixed(2)}px)` } : undefined}>
      <div style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, transformOrigin: "0 0", transform: stageTransform(stageAt(frame)) }}>
        {bd > 0 ? (
          <div style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, opacity: bd }}>
            <GameBackdrop />
          </div>
        ) : null}
        <Minimap />
      </div>
    </AbsoluteFill>
  );
};

/** The drop at 600: a thin shockwave off the disc's edge as the bezel opens. */
const Impact = () => {
  const frame = useCurrentFrame();
  const t = prog(frame, 600, 624);
  if (t <= 0 || t >= 1) return null;
  const r = HANDOFF.iris.r + 330 * easeOutCubic(t);
  const o = (1 - t) ** 1.6;
  return (
    <svg width={1920} height={1080} style={{ position: "absolute", left: 0, top: 0 }}>
      <circle cx={HANDOFF.iris.cx} cy={HANDOFF.iris.cy} r={r} fill="none" stroke={C.fg} strokeOpacity={0.1 * o} strokeWidth={16} />
      <circle cx={HANDOFF.iris.cx} cy={HANDOFF.iris.cy} r={r} fill="none" stroke={C.fg} strokeOpacity={0.5 * o} strokeWidth={2} />
    </svg>
  );
};

/**
 * Shot 6, OVERLAY (600-719). On the drop the iris becomes the round minimap and its compass bezel
 * assembles; the camera pulls back to show it in the top-right corner of a dusk game view ("ALWAYS /
 * ON TOP."), the minimap turns heading-up, and the camera pushes into the bezel for the match cut:
 * outer ring r 270 round the frame's centre, heading box at 12 o'clock, backdrop nearly black.
 */
export const Shot6Overlay = () => {
  const frame = useCurrentFrame();
  const blur = frame >= BLUR.from && frame < PUSH.to;
  // CameraMotionBlur samples [f + 1 - shutter, f + 1); the Freeze shifts that window to centre on the frame.
  return (
    <AbsoluteFill style={{ background: C.deep }}>
      {blur ? (
        <Freeze frame={frame - 1 + BLUR.shutter / 720}>
          <CameraMotionBlur samples={BLUR.samples} shutterAngle={BLUR.shutter}>
            <Stage soften />
          </CameraMotionBlur>
        </Freeze>
      ) : (
        <Stage />
      )}
      <Impact />
      <Headline lines={[{ text: "ALWAYS" }, { text: "ON TOP.", accent: "ON TOP." }]} at={[660, 675]} out={700} x={120} y={948} size={150} />
    </AbsoluteFill>
  );
};

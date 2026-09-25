import type { ReactNode } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C } from "../theme.ts";
import { Grain } from "./Grain.tsx";
import { Hud } from "./Hud.tsx";

const GRID = 40;
/** The dot grid drifts 0.05 px per frame, up and to the right. */
const DRIFT_X = 0.05 * Math.cos(Math.PI / 6);
const DRIFT_Y = -0.05 * Math.sin(Math.PI / 6);
const mod = (v: number, m: number) => ((v % m) + m) % m;

/**
 * Every shot's surroundings: a radial `C.bg` to `C.deep` backdrop with a faint drifting 40 px dot grid,
 * the shot, a vignette (45% black at the corners), film grain and, when `hud`, the HUD on top.
 */
export const Frame = ({ children, hud = true }: { children?: ReactNode; hud?: boolean }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse farthest-corner at 50% 46%, ${C.bg} 0%, ${C.deep} 100%)`,
        overflow: "hidden",
        isolation: "isolate",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: -GRID,
          top: -GRID,
          width: 1920 + 2 * GRID,
          height: 1080 + 2 * GRID,
          backgroundImage: "radial-gradient(circle, rgba(232, 234, 237, 0.07) 0 1.1px, rgba(232, 234, 237, 0) 1.7px)",
          backgroundSize: `${GRID}px ${GRID}px`,
          transform: `translate(${mod(frame * DRIFT_X, GRID)}px, ${mod(frame * DRIFT_Y, GRID)}px)`,
        }}
      />
      {children}
      <AbsoluteFill
        style={{
          background: "radial-gradient(ellipse farthest-corner at 50% 50%, rgba(0, 0, 0, 0) 38%, rgba(0, 0, 0, 0.14) 65%, rgba(0, 0, 0, 0.45) 100%)",
          pointerEvents: "none",
        }}
      />
      <Grain opacity={0.06} />
      {hud ? <Hud /> : null}
    </AbsoluteFill>
  );
};

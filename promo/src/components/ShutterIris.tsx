import { useId } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C } from "../theme.ts";
import { easeOutCubic, prog } from "../lib/ease.ts";

const BLADES = 6;
const FAR = 5000;

type P = { x: number; y: number };
const unit = (a: P, b: P): P => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l = Math.hypot(dx, dy) || 1;
  return { x: dx / l, y: dy / l };
};
const f = (n: number) => n.toFixed(2);

/**
 * Camera-shutter iris round (`cx`, `cy`): 6 blades close to the centre over at..at+4, a full-frame white
 * flash fires at at+2 (held to at+4, fading fast, gone by at+14), and the blades reopen over
 * at+4..at+12. The blades tile everything outside a turning hexagonal aperture; each blade's edge runs
 * along one side of the hexagon and on out to the frame, so the six lines sweep like a real iris.
 * Fills its positioned parent.
 */
export const ShutterIris = ({ at, cx = 960, cy = 540 }: { at: number; cx?: number; cy?: number }) => {
  const frame = useCurrentFrame();
  const id = `iris-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  if (frame < at || frame > at + 14) return null;
  // The blades snap shut (fast start, so they read at at+1 before the flash), then open under the fading flash.
  const k = frame < at + 4 ? prog(frame, at, at + 4, easeOutCubic) : 1 - prog(frame, at + 4, at + 12, easeOutCubic);
  // Peaks at at+2, holds to at+4, then decays quickly (x0.55 per frame) so the opening shows; 0 by at+14.
  const flash = frame < at + 2 ? 0 : frame <= at + 4 ? 1 : 0.55 ** (frame - at - 4) * (1 - prog(frame, at + 4, at + 14));
  // Open: the aperture's inradius clears the farthest corner of the frame. Never 0, so edges keep a direction.
  const open = Math.max(Math.hypot(cx, cy), Math.hypot(1920 - cx, cy), Math.hypot(cx, 1080 - cy), Math.hypot(1920 - cx, 1080 - cy)) + 40;
  const r = Math.max(0.5, open * (1 - k));
  const turn = ((-90 + 64 * k) * Math.PI) / 180;
  const rc = r / Math.cos(Math.PI / BLADES);
  const v: P[] = Array.from({ length: BLADES }, (_, i) => {
    const a = turn + (i * 2 * Math.PI) / BLADES;
    return { x: cx + rc * Math.cos(a), y: cy + rc * Math.sin(a) };
  });
  const blades = v.map((p, i) => {
    const back = unit(v[(i + BLADES - 1) % BLADES], p);
    const lip = unit(p, v[(i + 1) % BLADES]);
    // Shade from the lip into the blade: the component of `back` across the lip.
    const d = back.x * lip.x + back.y * lip.y;
    const nx = back.x - d * lip.x;
    const ny = back.y - d * lip.y;
    const nl = Math.hypot(nx, ny) || 1;
    return { p, back, lip, n: { x: nx / nl, y: ny / nl } };
  });
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {k > 0 ? (
        <svg width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
          <defs>
            {blades.map(({ p, n }, i) => (
              <linearGradient key={i} id={`${id}-${i}`} gradientUnits="userSpaceOnUse" x1={p.x} y1={p.y} x2={p.x + n.x * 140} y2={p.y + n.y * 140}>
                <stop offset={0} stopColor={C.panel} />
                <stop offset={0.25} stopColor="#0c0e11" />
                <stop offset={1} stopColor="#07080a" />
              </linearGradient>
            ))}
          </defs>
          {blades.map(({ p, back, lip }, i) => (
            <path
              key={i}
              d={`M${f(p.x)} ${f(p.y)}L${f(p.x + back.x * FAR)} ${f(p.y + back.y * FAR)}L${f(p.x + lip.x * FAR)} ${f(p.y + lip.y * FAR)}Z`}
              fill={`url(#${id}-${i})`}
            />
          ))}
          {blades.map(({ p, lip }, i) => (
            <path key={i} d={`M${f(p.x)} ${f(p.y)}L${f(p.x + lip.x * FAR)} ${f(p.y + lip.y * FAR)}`} stroke={C.line} strokeWidth={1} fill="none" />
          ))}
        </svg>
      ) : null}
      {flash > 0 ? <AbsoluteFill style={{ background: "#ffffff", opacity: flash }} /> : null}
    </AbsoluteFill>
  );
};

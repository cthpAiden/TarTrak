import type { CSSProperties, ReactNode } from "react";
import { Sequence, useVideoConfig } from "remotion";
import { World, type WorldProps } from "../world/World.tsx";
import type { Pt } from "../world/data.ts";

/** The frame's size and whether it is the vertical cut. */
export function useLayout(): { W: number; H: number; portrait: boolean } {
  const { width, height } = useVideoConfig();
  return { W: width, H: height, portrait: height > width };
}

export const rgba = (hex: string, a: number): string => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};
/** Blend of two "#rrggbb" theme colours. */
export const mixHex = (a: string, b: string, t: number): string => {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(((pa >> s) & 255) + (((pb >> s) & 255) - ((pa >> s) & 255)) * t);
  return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`;
};
export const lerpPt = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

/**
 * The World reads the showreel's global frames (reveal, landings, pops). The new scenes run on local
 * frames, so they see it this far ahead: the map revealed, teammates landed, nothing left to animate.
 */
const SETTLED = 1000;
export const SettledWorld = (props: WorldProps) => (
  <Sequence from={-SETTLED} layout="none">
    <World {...props} />
  </Sequence>
);
/** Only the map: no extracts, route, quests, pin or drawing. */
export const BARE = { extracts: false, route: false, quests: false, pin: false, stroke: false } as const;

/** A box at (x, y) whose children are laid out round (0, 0). */
export const At = ({ x, y, children, style }: { x: number; y: number; children?: ReactNode; style?: CSSProperties }) => (
  <div style={{ position: "absolute", left: x, top: y, width: 0, height: 0, ...style }}>{children}</div>
);

/** A dark gradient from one edge, behind a headline. */
export const EdgeScrim = ({ side, size, opacity = 1 }: { side: "bottom" | "top" | "left"; size: number; opacity?: number }) => {
  const dir = side === "bottom" ? "to top" : side === "top" ? "to bottom" : "to right";
  const box: CSSProperties = side === "left" ? { left: 0, top: 0, bottom: 0, width: size } : { left: 0, right: 0, height: size, [side]: 0 };
  return (
    <div
      style={{
        position: "absolute",
        ...box,
        opacity,
        background: `linear-gradient(${dir}, rgba(11, 13, 16, 0.82) 0%, rgba(11, 13, 16, 0.5) 45%, rgba(11, 13, 16, 0) 100%)`,
        pointerEvents: "none",
      }}
    />
  );
};

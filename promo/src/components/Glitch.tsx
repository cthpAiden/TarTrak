import type { ReactNode } from "react";
import { useId } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { clamp } from "../lib/ease.ts";
import { rng } from "../lib/random.ts";

type Band = { y0: number; y1: number; dx: number };

/** Three seeded horizontal slices (shares of the height) shifted by up to `shift` px, with the unshifted bands between them. */
function bands(frame: number, shift: number): Band[] {
  const r = rng(Math.imul(frame + 3, 7919) ^ 0x51ed27);
  const cuts: Band[] = [];
  for (let i = 0; i < 3; i++) {
    const h = 0.025 + r() * 0.075;
    const y0 = 0.04 + (i / 3) * 0.92 + r() * (0.92 / 3 - h);
    const dx = (r() < 0.5 ? -1 : 1) * (0.45 + 0.55 * r()) * shift;
    cuts.push({ y0, y1: y0 + h, dx });
  }
  const out: Band[] = [];
  let y = 0;
  for (const c of cuts) {
    out.push({ y0: y, y1: c.y0, dx: 0 }, c);
    y = c.y1;
  }
  out.push({ y0: y, y1: 1, dx: 0 });
  return out;
}

const RED = "1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0";
const GREEN = "0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0";
const BLUE = "0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0";

/**
 * RGB-split glitch for hard cuts. `amount` 0..1: above 0 the children go through an SVG filter that
 * shifts three seeded horizontal slices (new every frame) by up to 30 * amount px and splits red and
 * blue 8 * amount px either side of green; at 0 they render untouched (same tree, no filter, so nothing
 * remounts). The children fill the positioned parent; `width` is that box's width in px (the frame's by
 * default), used to turn the px offsets into the filter's box-relative units.
 */
export const Glitch = ({ amount, children, width = 1920 }: { amount: number; children?: ReactNode; width?: number }) => {
  const frame = useCurrentFrame();
  const id = `glitch-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const a = clamp(amount);
  const on = a > 0;
  const rgb = (8 * a) / width;
  return (
    <>
      {on ? (
        <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden>
          <filter
            id={id}
            x={0}
            y={0}
            width={1}
            height={1}
            filterUnits="objectBoundingBox"
            primitiveUnits="objectBoundingBox"
            colorInterpolationFilters="sRGB"
          >
            {bands(frame, (30 * a) / width).map((b, i) => (
              <feOffset key={i} in="SourceGraphic" dx={b.dx} dy={0} x={0} y={b.y0} width={1} height={b.y1 - b.y0} result={`band${i}`} />
            ))}
            <feMerge result="sliced">
              {Array.from({ length: 7 }, (_, i) => (
                <feMergeNode key={i} in={`band${i}`} />
              ))}
            </feMerge>
            <feOffset in="sliced" dx={-rgb} dy={0} result="redShift" />
            <feColorMatrix in="redShift" type="matrix" values={RED} result="red" />
            <feColorMatrix in="sliced" type="matrix" values={GREEN} result="green" />
            <feOffset in="sliced" dx={rgb} dy={0} result="blueShift" />
            <feColorMatrix in="blueShift" type="matrix" values={BLUE} result="blue" />
            <feBlend in="red" in2="green" mode="screen" result="redGreen" />
            <feBlend in="redGreen" in2="blue" mode="screen" />
          </filter>
        </svg>
      ) : null}
      <AbsoluteFill style={on ? { filter: `url(#${id})` } : undefined}>{children}</AbsoluteFill>
    </>
  );
};

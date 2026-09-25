import type { CSSProperties } from "react";
import { useCurrentFrame } from "remotion";
import { COND } from "../fonts.ts";
import { C, HEADLINE } from "../theme.ts";
import { easeInExpo, easeOutExpo, prog } from "../lib/ease.ts";

export type HeadlineLine = { text: string; accent?: string };

const LINE_HEIGHT = 0.92;
/** Line box top to the alphabetic baseline, in em, for IBM Plex Sans Condensed at line-height 0.92. */
const BASELINE = 0.835;
/**
 * The mask reaches this far (em) above and below each line box, so the Q's tail is not cut. It clips
 * only while a word of the line moves; at rest the line is unclipped, so the soft shadow is whole.
 */
const PAD_Y = 0.2;
const PAD_X = 0.3;
const STAGGER = 3;
const LEAVE_STAGGER = 1;
/** Travel (em) that puts a word fully outside its line's mask. */
const TRAVEL = LINE_HEIGHT + 2 * PAD_Y + 0.1;
const SHADOW = "0 0.015em 0.03em rgba(11, 13, 16, 0.5), 0 0.05em 0.2em rgba(11, 13, 16, 0.5)";
const ACCENT_SHADOW = `${SHADOW}, 0 0 0.26em rgba(240, 180, 41, 0.2)`;

type Run = { text: string; accent: boolean };

/** Splits a line into words, each a list of runs coloured by whether they fall in the accent. */
function words(line: HeadlineLine): Run[][] {
  // Typographic apostrophes: YOU'RE -> YOU’RE.
  const text = line.text.toUpperCase().replace(/'/g, "’");
  const acc = line.accent?.toUpperCase().replace(/'/g, "’");
  const a0 = acc ? text.indexOf(acc) : -1;
  const a1 = a0 >= 0 && acc ? a0 + acc.length : -1;
  const out: Run[][] = [];
  let i = 0;
  for (const w of text.split(" ")) {
    const runs: Run[] = [];
    for (let k = 0; k < w.length; k++) {
      const accent = i + k >= a0 && i + k < a1;
      const last = runs[runs.length - 1];
      if (last && last.accent === accent) last.text += w[k];
      else runs.push({ text: w[k], accent });
    }
    if (w.length > 0) out.push(runs);
    i += w.length + 1;
  }
  return out;
}

/**
 * Kinetic headline. Each word rises out of its line's baseline mask over 14 frames (easeOutExpo, skewY
 * 6° to 0), 3 frames after the word before it; line i starts at `at[i]`. All words leave upward over
 * 10 frames from `out` (easeInExpo, 1-frame stagger). IBM Plex Sans Condensed Bold, uppercase, the
 * `accent` substring in amber.
 *
 * Placement: `x` is the left edge, centre or right edge (per `align`); `y` is the baseline of the
 * LAST line, so the block grows upward from it.
 */
export const Headline = ({
  lines,
  at,
  out,
  x,
  y,
  size = HEADLINE.size,
  align = "left",
}: {
  lines: HeadlineLine[];
  at: number[];
  out: number;
  x: number;
  y: number;
  size?: number;
  align?: "left" | "center" | "right";
}) => {
  const frame = useCurrentFrame();
  const lh = size * LINE_HEIGHT;
  let n = 0;
  const perLine = lines.map((l) => words(l).map((runs) => ({ runs, index: n++ })));
  if (frame >= out + HEADLINE.leave + LEAVE_STAGGER * n) return null;
  const shiftX = align === "center" ? "-50%" : align === "right" ? "-100%" : "0%";
  const pad: CSSProperties = {
    boxSizing: "content-box",
    padding: `${PAD_Y * size}px ${PAD_X * size}px`,
    margin: `${-PAD_Y * size}px ${-PAD_X * size}px`,
  };
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y - BASELINE * size - (lines.length - 1) * lh,
        transform: `translateX(${shiftX})`,
        width: "max-content",
        // A flex column, so the lines' negative margins do not collapse into each other.
        display: "flex",
        flexDirection: "column",
        fontFamily: COND,
        fontWeight: 700,
        fontSize: size,
        letterSpacing: "-0.01em",
        textTransform: "uppercase",
        color: C.fg,
        textAlign: align,
        pointerEvents: "none",
      }}
    >
      {perLine.map((ws, li) => {
        const lineAt = at[Math.min(li, at.length - 1)] ?? 0;
        const motion = ws.map((w, wi) => {
          const start = lineAt + wi * STAGGER;
          const leaveAt = out + w.index * LEAVE_STAGGER;
          return {
            rise: prog(frame, start, start + HEADLINE.rise, easeOutExpo),
            leave: prog(frame, leaveAt, leaveAt + HEADLINE.leave, easeInExpo),
          };
        });
        const moving = motion.some((m) => (m.rise > 0 && m.rise < 1) || (m.leave > 0 && m.leave < 1));
        return (
          <div key={li} style={{ ...pad, height: lh, lineHeight: `${lh}px`, overflow: moving ? "hidden" : "visible", whiteSpace: "pre" }}>
            {ws.map((w, wi) => {
              const { rise, leave } = motion[wi];
              const ty = ((1 - rise) * TRAVEL - leave * TRAVEL) * size;
              const hidden = rise <= 0 || leave >= 1;
              return (
                <span key={wi}>
                  {wi > 0 ? " " : null}
                  <span
                    style={{
                      display: "inline-block",
                      visibility: hidden ? "hidden" : "visible",
                      transformOrigin: "0% 100%",
                      transform: `translateY(${ty}px) skewY(${6 * (1 - rise)}deg)`,
                    }}
                  >
                    {w.runs.map((r, ri) => (
                      <span key={ri} style={{ color: r.accent ? C.amber : undefined, textShadow: r.accent ? ACCENT_SHADOW : SHADOW }}>
                        {r.text}
                      </span>
                    ))}
                  </span>
                </span>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

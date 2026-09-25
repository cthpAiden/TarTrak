import type { CSSProperties } from "react";
import { useCurrentFrame } from "remotion";
import { MONO } from "../fonts.ts";
import { clamp, prog } from "../lib/ease.ts";
import { scramble } from "../lib/text.ts";

/** A character range [start, end) (end exclusive, like `slice`) and its colour. */
export type Highlight = { start: number; end: number; color: string };

/**
 * Decodes `text` left to right with `scramble()` from `from` to `to` (linear progress); characters not
 * yet resolved show as dimmed random glyphs. Resolved characters inside a `highlights` range take its
 * colour and a soft glow, which flares for 10 frames as the whole range resolves. Monospace by default;
 * `style` is merged over the defaults.
 */
export const ScrambleText = ({
  text,
  from,
  to,
  seed = 1,
  style,
  highlights = [],
}: {
  text: string;
  from: number;
  to: number;
  seed?: number;
  style?: CSSProperties;
  highlights?: Highlight[];
}) => {
  const frame = useCurrentFrame();
  const p = prog(frame, from, to);
  const shown = scramble(text, p, frame, seed);
  const done = Math.floor(clamp(p) * text.length);
  const glow = (h: Highlight) => {
    const age = frame - (from + (h.end / text.length) * (to - from));
    const flare = age >= 0 && age < 10 ? 1 - age / 10 : 0;
    return `0 0 ${10 + 14 * flare}px color-mix(in srgb, ${h.color} ${Math.round(55 + 35 * flare)}%, transparent)`;
  };
  // Runs of characters that share a look: unresolved, plain, or one highlight.
  const runs: Array<{ text: string; key: string; style?: CSSProperties }> = [];
  for (let i = 0; i < text.length; i++) {
    const h = i < done ? highlights.find((r) => i >= r.start && i < r.end) : undefined;
    const key = i >= done ? "scramble" : h ? `h${highlights.indexOf(h)}` : "plain";
    const last = runs[runs.length - 1];
    if (last && last.key === key) last.text += shown[i];
    else
      runs.push({
        text: shown[i],
        key,
        style: key === "scramble" ? { opacity: 0.45 } : h ? { color: h.color, textShadow: glow(h) } : undefined,
      });
  }
  return (
    <span style={{ fontFamily: MONO, whiteSpace: "pre", fontVariantNumeric: "tabular-nums", ...style }}>
      {runs.map((r, i) => (
        <span key={i} style={r.style}>
          {r.text}
        </span>
      ))}
    </span>
  );
};

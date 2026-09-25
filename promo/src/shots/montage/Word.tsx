import type { CSSProperties } from "react";
import { AbsoluteFill } from "remotion";
import { COND, MONO } from "../../fonts.ts";
import { C } from "../../theme.ts";
import { clamp, easeOutExpo, prog } from "../../lib/ease.ts";
import { CUTS, CUT_LEN, FILL, letterFill } from "./montage.ts";

const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};
/** Blend of two "#rrggbb" theme colours. */
const mix = (a: string, b: string, t: number) => {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(((pa >> s) & 255) + (((pb >> s) & 255) - ((pa >> s) & 255)) * t);
  return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`;
};

const SIZE = 260;
/** IBM Plex Sans Condensed at line-height 1: baseline 0.875 em under the line top, caps 0.70 em tall. */
const CAP_MID = 0.875 - 0.7 / 2;
/** A letter's inline box is the font's content area (ascent 1.025 + descent 0.275 em); fill level in % from its bottom. */
const level = (p: number) => 4 + 74 * p;
const MENISCUS = mix(C.amber, C.fg, 0.55);

/**
 * The montage's giant word: COND 700, 260 px, left edge at x 100, caps centred on the frame's middle.
 * Transparent with a 2 px C.fg outline at 85%; the letters fill amber one after another (a level
 * rising from the baseline, a light meniscus on top) and each outline turns amber as it fills.
 * The whole word scales up 1.5% over the cut.
 */
export const BigWord = ({ word, local }: { word: string; local: number }) => {
  const letters = [...word];
  const fills = letters.map((_, i) => letterFill(i, letters.length, local));
  const layer: CSSProperties = { whiteSpace: "pre", color: "transparent" };
  return (
    <div
      style={{
        position: "absolute",
        left: 100,
        top: 540 - CAP_MID * SIZE,
        font: `700 ${SIZE}px/1 ${COND}`,
        letterSpacing: "-0.01em",
        transformOrigin: `0 ${CAP_MID * SIZE}px`,
        transform: `scale(${1 + 0.015 * clamp(local / (CUT_LEN - 1))})`,
      }}
    >
      <div style={{ ...layer, position: "absolute", left: 0, top: 0, filter: `drop-shadow(0 0 16px ${rgba(C.amber, 0.38)})` }}>
        {letters.map((l, i) => {
          const L = level(fills[i]);
          const fill: CSSProperties =
            fills[i] > 0
              ? {
                  backgroundImage: `linear-gradient(to top, ${C.amber} ${L - 1.4}%, ${MENISCUS} ${L - 1.4}%, ${MENISCUS} ${L}%, transparent ${L}%)`,
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                }
              : {};
          return (
            <span key={i} style={fill}>
              {l}
            </span>
          );
        })}
      </div>
      <div style={{ ...layer, position: "relative" }}>
        {letters.map((l, i) => {
          const t = clamp((fills[i] - 0.4) / 0.6);
          const stroke = t > 0 ? mix(C.fg, C.amber, t) : rgba(C.fg, 0.85);
          return (
            <span key={i} style={{ WebkitTextStroke: `2px ${stroke}` }}>
              {l}
            </span>
          );
        })}
      </div>
    </div>
  );
};

/**
 * Top-left, under the HUD: "0N / 04" and a 4-segment bar, the current segment filling. The digit rolls
 * up over the cut, already three quarters in on the cut frame (the first cut's has nothing to roll out).
 */
export const Counter = ({ index, local }: { index: number; local: number }) => {
  const roll = prog(local + 1, 0, 5, easeOutExpo);
  const digit = (d: number, y: number) => (
    <span style={{ position: "absolute", left: 0, top: 0, transform: `translateY(${y}%)` }}>{d}</span>
  );
  return (
    <div
      style={{
        position: "absolute",
        left: 106,
        top: 98,
        display: "flex",
        alignItems: "center",
        gap: 18,
        font: `500 22px/28px ${MONO}`,
        letterSpacing: "0.08em",
        fontVariantNumeric: "tabular-nums",
        color: C.amber,
        whiteSpace: "pre",
      }}
    >
      <div style={{ display: "flex" }}>
        <span>0</span>
        <span style={{ position: "relative", display: "inline-block", overflow: "hidden", height: 28 }}>
          <span style={{ visibility: "hidden" }}>0</span>
          {digit(index + 1, (1 - roll) * 100)}
          {roll < 1 && index > 0 ? digit(index, -roll * 100) : null}
        </span>
        <span style={{ color: rgba(C.amber, 0.5) }}>{` / ${String(CUTS.length).padStart(2, "0")}`}</span>
      </div>
      <div style={{ display: "flex", gap: 4, width: 120 }}>
        {CUTS.map((_, i) => {
          const f = i < index ? 1 : i > index ? 0 : prog(local, 0, FILL[1]);
          return (
            <div key={i} style={{ position: "relative", flex: 1, height: 3, background: rgba(C.fg, 0.16) }}>
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: C.amber,
                  transformOrigin: "0 50%",
                  transform: `scaleX(${f})`,
                  boxShadow: f > 0 ? `0 0 8px ${rgba(C.amber, 0.55)}` : undefined,
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

const FLASH = [0.25, 0.14, 0.05];
/** Each cut enters with a 3-frame near-white flash at 25%, decaying. */
export const CutFlash = ({ local }: { local: number }) =>
  local >= 0 && local < FLASH.length ? <AbsoluteFill style={{ background: C.fg, opacity: FLASH[local], pointerEvents: "none" }} /> : null;

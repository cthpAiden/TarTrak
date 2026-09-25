import type { CSSProperties } from "react";
import { spring, useCurrentFrame } from "remotion";
import { Icon } from "../../components/ui.tsx";
import { COND, MONO, SANS } from "../../fonts.ts";
import { C, SPRING_POP } from "../../theme.ts";
import { clamp, easeOutCubic, easeOutExpo, lerp, prog } from "../../lib/ease.ts";
import { typed } from "../../lib/text.ts";

const W = 1920;
const amber = (a: number) => `rgba(240, 180, 41, ${a})`;

/**
 * The end card's rows, as the y of each row's cap-height centre. The logo sits at 336 (Shot7End). The
 * block runs from the tick's top (226) to the cursor's foot (833): centred 10 px above the frame's middle,
 * the wordmark (the heaviest row) just above it. Gaps: ring to caps 56, wordmark to tagline 34,
 * tagline to badges 54, badges to URL 53.
 */
export const ROWS = { word: 536, tagline: 634, badges: 723, url: 816 } as const;

/*
 * IBM Plex (all three families): ascent 1.025 em, descent 0.275 em, cap height 0.698 em. A line box of
 * height `lh` px has its baseline lh / 2 + 0.375 em below its top, so caps centred on y need the box top
 * at y - lh / 2 - 0.026 em.
 */
const lineTop = (y: number, size: number, lh: number) => y - lh / 2 - 0.026 * size;
const baselineIn = (size: number, lh: number) => lh / 2 + 0.375 * size;

/** A spring from `at`: 0 before, exactly 1 once settled (no transform left on the poster's text). */
const pop = (frame: number, at: number) =>
  frame < at ? 0 : frame >= at + 45 ? 1 : spring({ frame: frame - at, fps: 60, config: SPRING_POP });

const WORD = "TARTRAK";
const WORD_SIZE = 150;
const WORD_LH = WORD_SIZE;
const WORD_TOP = lineTop(ROWS.word, WORD_SIZE, WORD_LH);
/** The rise mask ends just under the baseline (TARTRAK has no descenders). */
const WORD_MASK = baselineIn(WORD_SIZE, WORD_LH) + 3;
/** The sweep's band: tilted 20° off vertical, 120 px across. */
const SWEEP_DEG = 110;

/**
 * TARTRAK: letters rise out of a baseline mask 3 frames apart (14 frames each, easeOutExpo) while the
 * tracking closes from 0.5em to 0.06em (742-772). The letters are inline spans moved with `top`, so the
 * word keeps its kerning. The light sweep (772-792) is a second, identical copy in white with a soft glow,
 * masked to a diagonal band that crosses the word left to right: a 30% white over #e8eaed letters would
 * not show, so the band is full white where it peaks.
 */
export const Wordmark = () => {
  const frame = useCurrentFrame();
  if (frame < 742) return null;
  const track = lerp(0.5, 0.06, prog(frame, 742, 772, easeOutExpo));
  const rise = [...WORD].map((_, i) => prog(frame, 742 + 3 * i, 756 + 3 * i, easeOutExpo));
  const moving = rise.some((p) => p < 1);
  const line = (extra?: CSSProperties) => (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: WORD_TOP,
        width: W,
        height: moving ? WORD_MASK : WORD_LH,
        overflow: moving ? "hidden" : "visible",
        // Tracking also follows the last letter; the same pad on the left keeps the letters centred.
        paddingLeft: `${track}em`,
        textAlign: "center",
        whiteSpace: "pre",
        fontFamily: COND,
        fontWeight: 700,
        fontSize: WORD_SIZE,
        lineHeight: `${WORD_LH}px`,
        letterSpacing: `${track}em`,
        color: C.fg,
        ...extra,
      }}
    >
      {[...WORD].map((ch, i) =>
        rise[i] >= 1 ? (
          <span key={i}>{ch}</span>
        ) : (
          <span key={i} style={{ position: "relative", top: (1 - rise[i]) * 0.9 * WORD_SIZE, visibility: rise[i] > 0 ? "visible" : "hidden" }}>
            {ch}
          </span>
        ),
      )}
    </div>
  );
  let sheen: CSSProperties | undefined;
  if (frame >= 772 && frame < 792) {
    // The band's centre crosses x 540 -> 1380 on the word's middle row at an even pace (about 3 frames
    // of light per letter); stops are px along the gradient line.
    const th = (SWEEP_DEG * Math.PI) / 180;
    const L = W * Math.sin(th) + WORD_LH * Math.abs(Math.cos(th));
    const pc = L / 2 + (lerp(540, 1380, prog(frame, 772, 792)) - W / 2) * Math.sin(th);
    const band = `linear-gradient(${SWEEP_DEG}deg, transparent ${pc - 60}px, rgba(0,0,0,0.45) ${pc - 28}px, #000 ${pc - 6}px, #000 ${pc + 6}px, rgba(0,0,0,0.45) ${pc + 28}px, transparent ${pc + 60}px)`;
    sheen = {
      color: "#ffffff",
      maskImage: band,
      WebkitMaskImage: band,
      filter: "drop-shadow(0 0 3px rgba(255, 255, 255, 0.9)) drop-shadow(0 0 16px rgba(255, 222, 160, 0.6))",
    };
  }
  return (
    <>
      {line()}
      {sheen ? line(sheen) : null}
    </>
  );
};

const TAG_SIZE = 34;
const TAG_LH = 44;
/** "The free squad map for Escape from Tarkov" fades up 12 px over 762-782. */
export const Tagline = () => {
  const frame = useCurrentFrame();
  const p = prog(frame, 762, 782, easeOutCubic);
  if (p <= 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: lineTop(ROWS.tagline, TAG_SIZE, TAG_LH),
        width: W,
        textAlign: "center",
        fontFamily: SANS,
        fontWeight: 500,
        fontSize: TAG_SIZE,
        lineHeight: `${TAG_LH}px`,
        color: C.fg2,
        opacity: p,
        transform: p < 1 ? `translateY(${(1 - p) * 12}px)` : undefined,
      }}
    >
      The free squad map for Escape from Tarkov
    </div>
  );
};

const BADGES = [
  { label: "FREE", at: 780 },
  { label: "OPEN SOURCE", at: 795 },
  { label: "BAN-SAFE", at: 810 },
] as const;

/** A pill that pops on its pluck (SPRING_POP) with a short amber flare; its check wipes on just after. */
const Badge = ({ label, at }: { label: string; at: number }) => {
  const frame = useCurrentFrame();
  const s = pop(frame, at);
  const wipe = prog(frame, at + 3, at + 11, easeOutCubic);
  const flare = frame >= at ? Math.max(0, 1 - (frame - at) / 18) : 0;
  return (
    <div
      style={{
        height: 46,
        display: "flex",
        alignItems: "center",
        gap: 10,
        // The check glyph sits 3.5/16 inside its box, so the left pad is that much smaller.
        padding: "0 20px 0 15px",
        borderRadius: 23,
        border: `1.5px solid ${C.amber}`,
        background: C.amberSoft,
        boxShadow: flare > 0 ? `0 0 18px ${amber(0.4 * flare)}` : undefined,
        color: C.amber,
        opacity: clamp(s * 2.5),
        transform: frame < at + 45 ? `scale(${0.6 + 0.4 * s})` : undefined,
      }}
    >
      <div style={{ clipPath: `inset(-2px ${(1 - wipe) * 100}% -2px -2px)` }}>
        <Icon name="check" size={22} />
      </div>
      <span style={{ fontFamily: MONO, fontWeight: 600, fontSize: 20, letterSpacing: "0.12em", marginRight: "-0.12em", color: C.fg }}>{label}</span>
    </div>
  );
};

/** FREE / OPEN SOURCE / BAN-SAFE, a centred row with 24 px gaps; the row is laid out whole from the start. */
export const Badges = () => {
  const frame = useCurrentFrame();
  if (frame < BADGES[0].at) return null;
  return (
    <div style={{ position: "absolute", left: 0, top: ROWS.badges - 23, width: W, height: 46, display: "flex", justifyContent: "center", gap: 24 }}>
      {BADGES.map((b) => (
        <Badge key={b.label} label={b.label} at={b.at} />
      ))}
    </div>
  );
};

const URL = "github.com/cthpAiden/TarTrak";
const URL_SIZE = 30;
const URL_LH = 40;
/**
 * The repo URL types out 810-840 (the whole string is laid out from the start, so it never shifts).
 * The amber block cursor is solid while typing, then blinks 15 frames off / 15 on, and is on at 899.
 */
export const Url = () => {
  const frame = useCurrentFrame();
  if (frame < 810) return null;
  const shown = typed(URL, prog(frame, 810, 840));
  const on = frame < 840 || Math.floor((frame - 840) / 15) % 2 === 1;
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: lineTop(ROWS.url, URL_SIZE, URL_LH),
        width: W,
        textAlign: "center",
        whiteSpace: "pre",
        fontFamily: MONO,
        fontWeight: 500,
        fontSize: URL_SIZE,
        lineHeight: `${URL_LH}px`,
        color: C.fg,
      }}
    >
      <span>{shown}</span>
      <span style={{ display: "inline-block", width: 0, height: 0, position: "relative" }}>
        <span
          style={{
            position: "absolute",
            left: 3,
            bottom: -7,
            width: 16,
            height: 34,
            background: C.amber,
            boxShadow: `0 0 10px ${amber(0.45)}`,
            opacity: on ? 1 : 0,
          }}
        />
      </span>
      <span style={{ visibility: "hidden" }}>{URL.slice(shown.length)}</span>
    </div>
  );
};

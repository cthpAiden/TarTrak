import { AbsoluteFill, spring, useCurrentFrame } from "remotion";
import { COND, MONO } from "../../fonts.ts";
import { C, SPRING_POP } from "../../theme.ts";
import { clamp, easeInCubic, easeInOutCubic, easeOutCubic, easeOutExpo, lerp, linear, prog, track } from "../../lib/ease.ts";
import { hash01 } from "../../lib/random.ts";
import { scramble, typed } from "../../lib/text.ts";
import { Headline } from "../../components/Headline.tsx";
import { Keycap } from "../../components/Keycap.tsx";
import { HeadingLine, PlayerDot } from "../../components/Markers.tsx";
import { Ping } from "../../components/Ping.tsx";
import { ShutterIris } from "../../components/ShutterIris.tsx";
import { ME, fromBearing } from "../../world/data.ts";
import { SAFE } from "../timeline.ts";
import { At, BARE, EdgeScrim, SettledWorld, rgba, useLayout } from "../kit.tsx";

// ---- what is read -----------------------------------------------------------------------------------

/** A screenshot name as the game writes it (src/lib/parse/screenshot.ts): position X, Y, Z, then the rotation quaternion. */
const NAME = "2026-09-25[14-32]_-182.40, 2.10, -71.03_0.00000, 0.40674, 0.00000, 0.91355 (0).png";
const X = -182.4;
const Z = -71.03;
/** yawFromQuaternion(0, 0.40674, 0, 0.91355). */
const HEADING = 48;
/** Where Customs' transform and 180° rotation (data/maps.json) put (X, Z): the point TarTrak draws you at. */
const MAP_POINT = "212.2, 119.4";

type Field = { text: string; start: number; end: number; label: string; token: string };
const field = (text: string, label: string, token: string): Field => {
  const start = NAME.indexOf(text);
  return { text, start, end: start + text.length, label, token };
};
/** Each field and what TarTrak makes of it. Y 2.1 is inside Customs' ground level. */
const FIELDS: readonly Field[] = [
  field("-182.40", "X · EAST–WEST", "−182.4 M"),
  field("2.10", "Y · HEIGHT", "GROUND LEVEL"),
  field("-71.03", "Z · NORTH–SOUTH", "−71.0 M"),
  field("0.00000, 0.40674, 0.00000, 0.91355", "ROTATION", "048° NE"),
];
const fieldOf = (i: number) => FIELDS.findIndex((f) => i >= f.start && i < f.end);
/** The vertical cut breaks the name before the rotation. */
const BREAK = FIELDS[3].start;

/** What the status line under the header says from each frame on. */
const STATUS: ReadonlyArray<readonly [number, string]> = [
  [0, "IN RAID"],
  [SAFE.press, "SCREENSHOT SAVED"],
  [SAFE.scan, "READING THE FILENAME"],
  [SAFE.drop[0], "TRANSLATING"],
  [SAFE.axes[0], "PLOTTING"],
  [SAFE.lock, "LOCKED ON · CUSTOMS"],
];
const CAPTION = "JUST FILES THE GAME ALREADY WRITES";

// ---- layout -------------------------------------------------------------------------------------------

type Box = { x: number; y: number; w: number; h: number };
type Layout = {
  header: { x: number; y: number; size: number };
  view: { cx: number; cy: number; w: number; h: number };
  key: { x: number; y: number; size: number };
  card: { cx: number; cy: number; s: number };
  name: { cx: number; top: number; font: number; gap: number; lines: ReadonlyArray<readonly [number, number]> };
  cells: Box[];
  cell: { pad: number; label: number; raw: number; ruler: number; token: number; tokenSize: number; rawMax: number; tick: number };
  plot: { cx: number; cy: number; left: number; right: number; top: number; bottom: number };
  hl: { y: number; size: number; caption: number };
};

const cellRow = (n: number, w: number, h: number, gap: number, left: number, top: number): Box[] =>
  Array.from({ length: n }, (_, k) => ({ x: left + k * (w + gap), y: top, w, h }));

function layoutFor(W: number, H: number, portrait: boolean): Layout {
  const cellText = (h: number, s: number) => ({
    pad: 24 * s, label: h * 0.12, raw: h * 0.29, ruler: h * 0.56, token: h * 0.87, tokenSize: 52 * s, rawMax: 28 * s, tick: 13 * s,
  });
  if (portrait) {
    const w = 470, h = 290, gap = 20, left = (W - 2 * w - gap) / 2;
    return {
      header: { x: 70, y: 150, size: 22 },
      view: { cx: W / 2, cy: 840, w: 960, h: 540 },
      key: { x: W / 2, y: 1290, size: 170 },
      card: { cx: W / 2, cy: 590, s: 0.3 },
      name: { cx: W / 2, top: 790, font: 36, gap: 104, lines: [[0, BREAK], [BREAK, NAME.length]] },
      cells: [...cellRow(2, w, h, gap, left, 1000), ...cellRow(2, w, h, gap, left, 1000 + h + gap)],
      cell: cellText(h, 1.12),
      plot: { cx: W / 2, cy: H / 2, left: 80, right: W - 80, top: 440, bottom: 1540 },
      hl: { y: H - 330, size: 118, caption: H - 280 },
    };
  }
  const w = 400, h = 250, gap = 26;
  return {
    header: { x: 130, y: 110, size: 20 },
    view: { cx: W / 2, cy: 520, w: 1120, h: 630 },
    key: { x: 1490, y: 810, size: 150 },
    card: { cx: W / 2, cy: 290, s: 0.24 },
    name: { cx: W / 2, top: 400, font: 30, gap: 0, lines: [[0, NAME.length]] },
    cells: cellRow(4, w, h, gap, (W - 4 * w - 3 * gap) / 2, 490),
    cell: cellText(h, 1),
    plot: { cx: W / 2, cy: H / 2, left: 240, right: W - 240, top: 240, bottom: 910 },
    hl: { y: H - 140, size: 116, caption: H - 96 },
  };
}

// ---- motion helpers -------------------------------------------------------------------------------------

const pop = (frame: number, at: number) => (frame < at ? 0 : spring({ frame: frame - at, fps: 60, config: SPRING_POP }));
const amber = (a: number) => rgba(C.amber, a);

/** Characters of the name behind the read head (fractional while it crosses one). */
const headAt = (frame: number) =>
  track(frame, [
    [SAFE.scan, 0, linear],
    ...FIELDS.map((f, k) => [SAFE.fields[k], f.end, linear] as const),
    [SAFE.scanEnd, NAME.length],
  ]);

/** Where character i of the name sits (its centre) and its size, before it falls or drops. */
function homeOf(L: Layout, i: number) {
  const { cx, top, font, gap, lines } = L.name;
  const li = lines.findIndex(([a, b]) => i >= a && i < b);
  const [a, b] = lines[li];
  const adv = font * 0.6;
  return { x: cx - ((b - a) * adv) / 2 + (i - a) * adv + adv / 2, y: top + li * gap, font };
}

/** Where character j of field k lands in its cell: the field's raw text, sized to fit. */
function slotOf(L: Layout, k: number, j: number) {
  const box = L.cells[k];
  const f = FIELDS[k];
  const font = Math.min(L.cell.rawMax, (box.w - 2 * L.cell.pad) / (f.text.length * 0.6));
  const adv = font * 0.6;
  return { x: box.x + L.cell.pad + j * adv + adv / 2, y: box.y + L.cell.raw, font };
}

/** A cell's way out as the plot takes over (k staggers it). */
const cellLeave = (frame: number, k: number) => prog(frame, SAFE.axes[0] + k * 2, SAFE.axes[0] + k * 2 + 14, easeInCubic);

// ---- the game view and its file card ---------------------------------------------------------------------

/** Looking along my heading from 150 m behind the focus, so my own marker stays below the frame. */
const viewCam = (frame: number) => {
  const ahead = lerp(150, 165, prog(Math.min(frame, SAFE.shutter), 0, SAFE.shutter));
  const p = fromBearing(ME, HEADING, ahead);
  return { x: p.x, y: p.y, zoom: 2.4, tilt: 62, turn: HEADING };
};

const Crosshair = () => (
  <svg width={60} height={60} viewBox="-30 -30 60 60" style={{ position: "absolute", left: -30, top: -30, overflow: "visible", filter: `drop-shadow(0 0 3px ${amber(0.5)})` }}>
    <g stroke={C.fg} strokeWidth={1.5} fill="none" opacity={0.85}>
      <line x1={-22} y1={0} x2={-7} y2={0} />
      <line x1={7} y1={0} x2={22} y2={0} />
      <line x1={0} y1={-22} x2={0} y2={-7} />
      <line x1={0} y1={7} x2={0} y2={22} />
    </g>
    <circle r={2} fill={C.amber} />
  </svg>
);

/**
 * The game, then its screenshot: a 3D view along my heading with a crosshair; the shutter freezes it, it
 * gains a white border and shrinks into a tilted file card above the filename, which it leaves to the scan.
 */
const GameView = ({ frame, L }: { frame: number; L: Layout }) => {
  if (frame > SAFE.scan + 18) return null;
  const { view, card } = L;
  const enter = prog(frame, 0, 14, easeOutExpo);
  const t = prog(frame, SAFE.shrink[0], SAFE.shrink[1], easeInOutCubic);
  const s = lerp(lerp(0.94, 1, enter), card.s, t);
  const leave = prog(frame, SAFE.scan, SAFE.scan + 16, easeInCubic);
  const x = lerp(view.cx, card.cx, t);
  const y = lerp(view.cy, card.cy, t) - 40 * leave;
  const frozen = frame >= SAFE.shutter;
  const border = 14 * prog(frame, SAFE.shutter + 2, SAFE.shrink[0] + 8, easeOutCubic);
  const hud = 1 - prog(frame, SAFE.shutter, SAFE.shutter + 4);
  return (
    <div
      style={{
        position: "absolute",
        left: x - view.w / 2,
        top: y - view.h / 2,
        width: view.w,
        height: view.h,
        opacity: enter * (1 - leave),
        transform: `scale(${s}) rotate(${-3 * t}deg)`,
        borderRadius: 18,
        overflow: "hidden",
        boxShadow: `0 ${30 + 20 * t}px ${80}px rgba(0, 0, 0, 0.6), 0 0 0 1px ${C.line2}`,
      }}
    >
      <div style={{ position: "absolute", inset: 0, filter: "brightness(1.3) saturate(0.85) contrast(1.06)" }}>
        <SettledWorld cam={viewCam(frame)} width={view.w} height={view.h} show={{ ...BARE, mates: false, labels: false, grid: false }} />
      </div>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 45%, rgba(0, 0, 0, 0) 55%, rgba(0, 0, 0, 0.55) 100%)" }} />
      {hud > 0 ? (
        <div style={{ position: "absolute", inset: 0, opacity: hud }}>
          <At x={view.w / 2} y={view.h / 2}>
            <Crosshair />
          </At>
          <div style={{ position: "absolute", left: 28, top: 24, font: `600 16px ${MONO}`, letterSpacing: "0.16em", color: C.fg2 }}>
            <span style={{ color: C.north }}>●</span> IN RAID · CUSTOMS
          </div>
        </div>
      ) : null}
      {frozen ? (
        <div style={{ position: "absolute", inset: 0, borderRadius: 18, boxShadow: `inset 0 0 0 ${border}px ${C.fg}` }} />
      ) : null}
    </div>
  );
};

// ---- the filename, taken apart --------------------------------------------------------------------------

/**
 * Every character of the name, one box each: it decodes, the read head turns it amber (a field) or grey
 * (the rest), the rest falls away, and each field's characters arc down into its cell.
 */
const NameChars = ({ frame, L }: { frame: number; L: Layout }) => {
  if (frame < SAFE.decode[0]) return null;
  const decoded = Math.floor(prog(frame, SAFE.decode[0], SAFE.decode[1]) * NAME.length);
  const head = headAt(frame);
  const out = [];
  for (let i = 0; i < NAME.length; i++) {
    const ch = NAME[i];
    if (ch === " ") continue;
    const k = fieldOf(i);
    const home = homeOf(L, i);
    let { x, y, font } = home;
    let opacity = 1;
    let rot = 0;
    let color: string = C.fg2;
    let glow = 0;
    let shown = ch;
    if (i >= decoded) {
      shown = scramble(ch, 0, frame, 11 + 97 * i, 2);
      opacity = 0.4;
      color = C.muted;
    } else if (head > i) {
      const age = head - i;
      if (k >= 0) {
        color = C.amber;
        glow = 0.45 + 0.55 * clamp(1 - age / 5);
      } else {
        color = C.muted;
        opacity = lerp(1, 0.3, clamp(age / 3));
      }
    }
    if (k < 0) {
      // The rest falls: each character on its own clock, tumbling as it goes.
      const t = frame - (SAFE.fall + hash01(3, i) * 8);
      if (t > 0) {
        y += 0.9 * t * t * (0.6 + 0.8 * hash01(5, i));
        x += (hash01(7, i) - 0.5) * 4 * t;
        rot = (hash01(9, i) - 0.5) * 6 * t;
        opacity *= 1 - clamp(t / 16);
        if (opacity <= 0) continue;
      }
    } else {
      const j = i - FIELDS[k].start;
      const start = SAFE.drop[0] + k * 1.5 + j * 0.12;
      const d = prog(frame, start, start + 12, easeInOutCubic);
      if (d > 0) {
        const slot = slotOf(L, k, j);
        x = lerp(home.x, slot.x, d);
        y = lerp(home.y, slot.y, d) - Math.sin(Math.PI * d) * 70;
        font = lerp(home.font, slot.font, d);
        glow = Math.max(glow, 0.45);
      }
      if (frame >= SAFE.resolve[k]) opacity = lerp(1, 0.6, prog(frame, SAFE.resolve[k], SAFE.resolve[k] + 8));
      opacity *= 1 - cellLeave(frame, k);
      if (opacity <= 0) continue;
    }
    out.push(
      <div
        key={i}
        style={{
          position: "absolute",
          left: x - font * 0.3,
          top: y - font / 2,
          width: font * 0.6,
          height: font,
          lineHeight: `${font}px`,
          textAlign: "center",
          font: `500 ${font}px ${MONO}`,
          color,
          opacity,
          transform: rot ? `rotate(${rot}deg)` : undefined,
          textShadow: glow > 0 ? `0 0 ${8 + 14 * glow}px ${amber(0.35 + 0.45 * glow)}` : undefined,
        }}
      >
        {shown}
      </div>,
    );
  }
  return <>{out}</>;
};

/** The read head: an amber caret with a comet of light behind it, line by line. */
const ReadHead = ({ frame, L }: { frame: number; L: Layout }) => {
  if (frame < SAFE.scan || frame > SAFE.scanEnd + 2) return null;
  const head = Math.min(headAt(frame), NAME.length);
  const i = Math.min(Math.floor(head), NAME.length - 1);
  const home = homeOf(L, i);
  const adv = home.font * 0.6;
  const x = home.x - adv / 2 + (head - i) * adv;
  const fade = 1 - prog(frame, SAFE.scanEnd, SAFE.scanEnd + 2);
  return (
    <div style={{ position: "absolute", left: 0, top: 0, opacity: fade }}>
      <div
        style={{
          position: "absolute", left: x - adv * 7, top: home.y - home.font * 0.8, width: adv * 7, height: home.font * 1.6,
          background: `linear-gradient(to right, ${amber(0)}, ${amber(0.22)})`,
        }}
      />
      <div
        style={{
          position: "absolute", left: x - 1.5, top: home.y - home.font * 0.85, width: 3, height: home.font * 1.7,
          background: "#fff1cc", boxShadow: `0 0 12px 2px ${amber(0.8)}`,
        }}
      />
    </div>
  );
};

/** Brackets under each field as the head leaves it, with what the field is. */
const Brackets = ({ frame, L }: { frame: number; L: Layout }) => {
  if (frame < SAFE.fields[0] || frame > SAFE.fall + 10) return null;
  const gone = prog(frame, SAFE.fall, SAFE.fall + 8);
  return (
    <>
      {FIELDS.map((f, k) => {
        if (frame < SAFE.fields[k]) return null;
        const a = homeOf(L, f.start);
        const b = homeOf(L, f.end - 1);
        const adv = a.font * 0.6;
        const open = prog(frame, SAFE.fields[k], SAFE.fields[k] + 6, easeOutCubic);
        const x0 = a.x - adv / 2 + 2;
        const x1 = b.x + adv / 2 - 2;
        const mid = (x0 + x1) / 2;
        const half = ((x1 - x0) / 2) * open;
        const y = a.y + a.font * 0.72;
        return (
          <div key={k} style={{ position: "absolute", left: 0, top: 0, opacity: 1 - gone }}>
            <svg width={1} height={1} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
              <path d={`M${mid - half} ${y - 7}V${y}H${mid + half}V${y - 7}`} fill="none" stroke={C.amber} strokeWidth={1.5} />
            </svg>
            <div
              style={{
                position: "absolute", left: mid - 200, width: 400, top: y + 8, textAlign: "center",
                font: `600 ${Math.round(a.font * 0.56)}px ${MONO}`, letterSpacing: "0.14em", color: C.amber,
                opacity: prog(frame, SAFE.fields[k] + 2, SAFE.fields[k] + 6), transform: `translateY(${(1 - open) * -6}px)`,
              }}
            >
              {f.label.split(" ·")[0]}
            </div>
          </div>
        );
      })}
    </>
  );
};

// ---- the decoder cells -----------------------------------------------------------------------------------

/** Three floor slabs; at its translation a marker drops onto the ground one, which lights. */
const Floors = ({ frame, x, y, s }: { frame: number; x: number; y: number; s: number }) => {
  const at = SAFE.resolve[1];
  const lit = prog(frame, at, at + 6);
  const drop = pop(frame, at - 6);
  return (
    <>
      {[-1, 0, 1].map((r) => (
        <div
          key={r}
          style={{
            position: "absolute", left: x - 70 * s, top: y + r * 20 * s - 4 * s, width: 140 * s, height: 8 * s,
            transform: "skewX(-40deg)",
            background: r === 0 ? `color-mix(in srgb, ${C.amber} ${Math.round(lit * 100)}%, ${C.raised2})` : C.raised2,
            boxShadow: r === 0 && lit > 0 ? `0 0 ${14 * lit}px ${amber(0.5 * lit)}` : undefined,
            border: `1px solid ${C.line2}`,
          }}
        />
      ))}
      {frame >= at - 6 ? (
        <At x={x} y={lerp(y - 50 * s, y - 10 * s, drop)}>
          <div style={{ position: "absolute", left: -5 * s, top: -5 * s, width: 10 * s, height: 10 * s, borderRadius: "50%", background: C.amber, boxShadow: `0 0 10px ${amber(0.7)}` }} />
        </At>
      ) : null}
      <div
        style={{
          position: "absolute", left: x + 86 * s, top: y - 8 * s, font: `600 ${13 * s}px ${MONO}`, letterSpacing: "0.12em",
          color: C.amber, opacity: lit,
        }}
      >
        GROUND
      </div>
    </>
  );
};

/** One decoder cell: what the field is, its raw text (the dropped characters), a gauge, and the translation. */
const Cell = ({ k, frame, L, portrait }: { k: number; frame: number; L: Layout; portrait: boolean }) => {
  const appear = SAFE.drop[0] - 6 + k * 3;
  if (frame < appear) return null;
  const box = L.cells[k];
  const f = FIELDS[k];
  const { pad, label, token, tokenSize } = L.cell;
  const enter = pop(frame, appear);
  const leave = cellLeave(frame, k);
  if (leave >= 1) return null;
  const at = SAFE.resolve[k];
  const flash = frame >= at ? 1 - prog(frame, at, at + 16) : 0;
  const done = prog(frame, at, at + 10);
  const shown = frame < at ? "" : scramble(f.token, done, frame, 31 + k, 1);
  const s = portrait ? 1.12 : 1;
  return (
    <div
      style={{
        position: "absolute", left: box.x, top: box.y, width: box.w, height: box.h,
        opacity: clamp(enter * 1.5) * (1 - leave),
        transform: `translateY(${(1 - enter) * 30 - leave * 30}px) scale(${lerp(0.94, 1, enter)})`,
      }}
    >
      <div
        style={{
          position: "absolute", inset: 0, borderRadius: 14, background: rgba(C.panel, 0.78),
          border: `1.5px solid color-mix(in srgb, ${C.amber} ${Math.round(Math.max(flash, 0.25 * done) * 100)}%, ${C.line2})`,
          boxShadow: `0 16px 40px rgba(0, 0, 0, 0.45), 0 0 ${30 * flash}px ${amber(0.35 * flash)}`,
        }}
      />
      <div style={{ position: "absolute", left: 0, top: 18, width: 4, height: 26 * s, borderRadius: "0 3px 3px 0", background: C.amber }} />
      <div
        style={{
          position: "absolute", left: pad, top: label - 8 * s, font: `600 ${15 * s}px ${MONO}`, letterSpacing: "0.14em", color: C.muted,
        }}
      >
        {f.label}
      </div>
      {k === 1 ? <Floors frame={frame} x={box.w / 2 - 30 * s} y={L.cell.ruler} s={s} /> : null}
      <div
        style={{
          position: "absolute", left: pad, top: token - tokenSize * 0.84, font: `700 ${tokenSize}px/1 ${COND}`, letterSpacing: "0.01em",
          color: C.fg, whiteSpace: "nowrap", textShadow: flash > 0 ? `0 0 ${24 * flash}px ${amber(0.6 * flash)}` : undefined,
        }}
      >
        {shown}
      </div>
    </div>
  );
};

// ---- rulers, compass, grid and lock (one SVG over the frame) ---------------------------------------------

/** A ruler: origin, direction (deg, screen), length (px), px per metre, and the value at the origin. */
type Ruler = { ox: number; oy: number; ang: number; len: number; scale: number; v0: number };
const lerpRuler = (a: Ruler, b: Ruler, t: number): Ruler => ({
  ox: lerp(a.ox, b.ox, t), oy: lerp(a.oy, b.oy, t), ang: lerp(a.ang, b.ang, t), len: lerp(a.len, b.len, t), scale: lerp(a.scale, b.scale, t), v0: lerp(a.v0, b.v0, t),
});

/** Ticks every 25 m (labelled every 100 m on side `side`) and, once `mark` > 0, a pointer at `value`. */
const RulerDraw = ({ r, value, mark, side, tick, opacity }: { r: Ruler; value: number; mark: number; side: 1 | -1; tick: number; opacity: number }) => {
  if (opacity <= 0) return null;
  const a = (r.ang * Math.PI) / 180;
  const d = { x: Math.cos(a), y: Math.sin(a) };
  const n = { x: -d.y * side, y: d.x * side };
  const at = (v: number) => ({ x: r.ox + d.x * (v - r.v0) * r.scale, y: r.oy + d.y * (v - r.v0) * r.scale });
  const ticks = [];
  for (let v = Math.ceil(r.v0 / 25) * 25; (v - r.v0) * r.scale <= r.len + 0.5; v += 25) {
    const p = at(v);
    const major = v % 100 === 0;
    const l = major ? 10 : 5;
    ticks.push(
      <g key={v}>
        <line x1={p.x} y1={p.y} x2={p.x + n.x * l} y2={p.y + n.y * l} stroke={major ? C.fg2 : C.muted} strokeWidth={1} />
        {major ? (
          <text x={p.x + n.x * (l + tick)} y={p.y + n.y * (l + tick)} fill={C.muted} fontFamily={MONO} fontSize={tick} textAnchor="middle" dominantBaseline="central">
            {v}
          </text>
        ) : null}
      </g>,
    );
  }
  const end = { x: r.ox + d.x * r.len, y: r.oy + d.y * r.len };
  // The pointer slides in from the ruler's start, overshooting a little.
  const pv = lerp(r.v0, value, mark);
  const p = at(pv);
  const tri = 9;
  return (
    <g opacity={opacity}>
      <line x1={r.ox} y1={r.oy} x2={end.x} y2={end.y} stroke={C.fg2} strokeWidth={1.5} />
      {ticks}
      {mark > 0 ? (
        <g style={{ filter: `drop-shadow(0 0 6px ${amber(0.8)})` }}>
          <path
            d={`M${p.x} ${p.y}L${p.x - n.x * tri * 1.6 - d.x * tri} ${p.y - n.y * tri * 1.6 - d.y * tri}L${p.x - n.x * tri * 1.6 + d.x * tri} ${p.y - n.y * tri * 1.6 + d.y * tri}Z`}
            fill={C.amber}
          />
          <circle cx={p.x} cy={p.y} r={3.5} fill="#fff1cc" />
        </g>
      ) : null}
    </g>
  );
};

/** The compass: a dial with north in red and a needle that spins down onto the heading. */
const Compass = ({ x, y, r, angle, lit, opacity }: { x: number; y: number; r: number; angle: number; lit: number; opacity: number }) => {
  if (opacity <= 0 || r <= 0.5) return null;
  const ticks = Array.from({ length: 12 }, (_, i) => {
    const a = (i * 30 * Math.PI) / 180;
    const l = i % 3 === 0 ? 0.2 : 0.1;
    return (
      <line
        key={i}
        x1={x + Math.sin(a) * r}
        y1={y - Math.cos(a) * r}
        x2={x + Math.sin(a) * r * (1 - l)}
        y2={y - Math.cos(a) * r * (1 - l)}
        stroke={i === 0 ? C.north : C.muted}
        strokeWidth={i === 0 ? 3 : 1.5}
      />
    );
  });
  const a = (angle * Math.PI) / 180;
  const tip = { x: x + Math.sin(a) * r * 0.86, y: y - Math.cos(a) * r * 0.86 };
  const side = { x: Math.cos(a) * r * 0.09, y: Math.sin(a) * r * 0.09 };
  const tail = { x: x - Math.sin(a) * r * 0.4, y: y + Math.cos(a) * r * 0.4 };
  return (
    <g opacity={opacity}>
      <circle cx={x} cy={y} r={r} fill={rgba(C.deep, 0.55)} stroke={`color-mix(in srgb, ${C.amber} ${Math.round(lit * 100)}%, ${C.line2})`} strokeWidth={2} />
      {ticks}
      <path d={`M${tip.x} ${tip.y}L${x + side.x} ${y + side.y}L${tail.x} ${tail.y}L${x - side.x} ${y - side.y}Z`} fill={C.amber} style={{ filter: `drop-shadow(0 0 6px ${amber(0.6)})` }} />
      <circle cx={x} cy={y} r={r * 0.07} fill={C.fg} />
    </g>
  );
};

/** Needle angle: two and a half turns spinning down onto the heading as the rotation cell translates, then a wobble. */
function needleAt(frame: number): number {
  const r = SAFE.resolve[3];
  const spin = 900 * (1 - easeOutCubic(prog(frame, SAFE.drop[1], r)));
  const wobble = frame > r ? 7 * Math.exp(-(frame - r) / 5) * Math.sin((frame - r) * 0.9) : 0;
  return HEADING - spin + wobble;
}

/** Four corner brackets closing on a point; `d` is the half-size. */
const Reticle = ({ x, y, d, turn }: { x: number; y: number; d: number; turn: number }) => {
  const arm = d * 0.45;
  return (
    <g transform={`rotate(${turn} ${x} ${y})`} stroke={C.amber} strokeWidth={3} fill="none" style={{ filter: `drop-shadow(0 0 8px ${amber(0.7)})` }}>
      {[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => (
        <path key={`${sx}${sy}`} d={`M${x + sx * d} ${y + sy * (d - arm)}V${y + sy * d}H${x + sx * (d - arm)}`} />
      ))}
    </g>
  );
};

/**
 * X's and Z's rulers swing out of their cells into the grid's bottom and left axes (Z turning upright),
 * the compass flies to where they will meet, both throw dashed lines from their pointers, and the lines
 * meet on the compass; the reticle closes on it.
 */
const Plot = ({ frame, L, W, H }: { frame: number; L: Layout; W: number; H: number }) => {
  if (frame < SAFE.drop[0]) return null;
  const { plot, cell } = L;
  const inCell = (k: number, v0: number): Ruler => {
    const box = L.cells[k];
    const len = box.w - 2 * cell.pad;
    return { ox: box.x + cell.pad, oy: box.y + cell.ruler, ang: 0, len, scale: len / 300, v0 };
  };
  const PX_PER_M = 4;
  const xAxis: Ruler = { ox: plot.left, oy: plot.bottom, ang: 0, len: plot.right - plot.left, scale: PX_PER_M, v0: X - (plot.cx - plot.left) / PX_PER_M };
  const zAxis: Ruler = { ox: plot.left, oy: plot.bottom, ang: -90, len: plot.bottom - plot.top, scale: PX_PER_M, v0: Z - (plot.bottom - plot.cy) / PX_PER_M };
  const tx = prog(frame, SAFE.axes[0], SAFE.axes[1], easeInOutCubic);
  const tz = prog(frame, SAFE.axes[0] + 4, SAFE.axes[1] + 4, easeInOutCubic);
  const appear = (k: number) => prog(frame, SAFE.drop[0] - 6 + k * 3 + 4, SAFE.drop[0] + k * 3 + 10);
  const mark = (k: number) => (frame < SAFE.resolve[k] ? 0 : spring({ frame: frame - SAFE.resolve[k], fps: 60, config: SPRING_POP }));
  const mapGone = 1 - prog(frame, SAFE.map[0] + 8, SAFE.map[0] + 26);
  const grid = prog(frame, SAFE.axes[0] + 8, SAFE.axes[1] + 8) * mapGone;

  // The compass: in the rotation cell, then centred where the lines will meet; at the lock it closes into my dot.
  const rotBox = L.cells[3];
  const tc = prog(frame, SAFE.axes[0] + 2, SAFE.axes[1] + 2, easeInOutCubic);
  const cr = lerp(rotBox.h * 0.2, 84, tc) * (1 - prog(frame, SAFE.lock - 6, SAFE.lock + 2, easeInCubic));
  const cx = lerp(rotBox.x + rotBox.w - cell.pad - rotBox.h * 0.2, plot.cx, tc);
  const cy = lerp(rotBox.y + cell.ruler + rotBox.h * 0.04, plot.cy, tc);

  const lines = prog(frame, SAFE.project[0], SAFE.project[1], easeInOutCubic);
  const lineFade = mapGone;
  const lock = prog(frame, SAFE.project[1] - 8, SAFE.lock, easeOutExpo);
  const reticleOut = 1 - prog(frame, SAFE.out, SAFE.out + 10);
  const gridLines = [];
  if (grid > 0) {
    for (let x = plot.cx - Math.floor((plot.cx - plot.left) / 100) * 100; x <= plot.right; x += 100)
      gridLines.push(<line key={`x${x}`} x1={x} y1={plot.top} x2={x} y2={plot.bottom} />);
    for (let y = plot.cy - Math.floor((plot.cy - plot.top) / 100) * 100; y <= plot.bottom; y += 100)
      gridLines.push(<line key={`y${y}`} x1={plot.left} y1={y} x2={plot.right} y2={y} />);
  }
  return (
    <>
      <svg width={W} height={H} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        {grid > 0 ? (
          <g opacity={grid}>
            <g stroke={C.line2} strokeWidth={1}>{gridLines}</g>
            <text x={plot.right + 14} y={plot.bottom} fill={C.amber} fontFamily={MONO} fontSize={20} fontWeight={600} dominantBaseline="central">X</text>
            <text x={plot.left} y={plot.top - 18} fill={C.amber} fontFamily={MONO} fontSize={20} fontWeight={600} textAnchor="middle">Z</text>
          </g>
        ) : null}
        <RulerDraw r={lerpRuler(inCell(0, -300), xAxis, tx)} value={X} mark={mark(0)} side={1} tick={cell.tick} opacity={appear(0) * mapGone} />
        <RulerDraw r={lerpRuler(inCell(2, -200), zAxis, tz)} value={Z} mark={mark(2)} side={-1} tick={cell.tick} opacity={appear(2) * mapGone} />
        {lines > 0 && lineFade > 0 ? (
          <g opacity={lineFade} stroke={C.amber} strokeWidth={2.5} strokeDasharray="12 10" style={{ filter: `drop-shadow(0 0 6px ${amber(0.7)})` }}>
            <line x1={plot.cx} y1={plot.bottom} x2={plot.cx} y2={lerp(plot.bottom, plot.cy, lines)} />
            <line x1={plot.left} y1={plot.cy} x2={lerp(plot.left, plot.cx, lines)} y2={plot.cy} />
            {lines < 1 ? (
              <g stroke="none" fill="#fff1cc">
                <circle cx={plot.cx} cy={lerp(plot.bottom, plot.cy, lines)} r={5} />
                <circle cx={lerp(plot.left, plot.cx, lines)} cy={plot.cy} r={5} />
              </g>
            ) : null}
          </g>
        ) : null}
        <Compass x={cx} y={cy} r={cr} angle={needleAt(frame)} lit={prog(frame, SAFE.resolve[3], SAFE.resolve[3] + 6)} opacity={appear(3)} />
        {lock > 0 && reticleOut > 0 ? (
          <g opacity={reticleOut}>
            <Reticle x={plot.cx} y={plot.cy} d={lerp(160, 36, lock)} turn={45 * (1 - lock)} />
          </g>
        ) : null}
      </svg>
      <Ping at={SAFE.project[1]} cx={plot.cx} cy={plot.cy} maxR={90} dur={24} />
      <Ping at={SAFE.lock} cx={plot.cx} cy={plot.cy} maxR={220} dur={40} />
    </>
  );
};

/**
 * My marker as the compass closes: the dot and the heading line drawn out of it (handed to the map's own
 * marker once the map is up), the projected point and the map's name.
 */
const Lock = ({ frame, L, portrait }: { frame: number; L: Layout; portrait: boolean }) => {
  if (frame < SAFE.lock - 2) return null;
  const { plot } = L;
  const out = 1 - prog(frame, SAFE.out, SAFE.out + 10);
  if (out <= 0) return null;
  const dot = pop(frame, SAFE.lock - 2) * (1 - prog(frame, SAFE.map[1], SAFE.map[1] + 12));
  const draw = prog(frame, SAFE.lock, SAFE.lock + 14, easeOutCubic);
  const read = typed(`MAP  ${MAP_POINT}`, prog(frame, SAFE.lock + 4, SAFE.lock + 18));
  const tag = pop(frame, SAFE.tag);
  const s = portrait ? 1.1 : 1;
  return (
    <div style={{ position: "absolute", inset: 0, opacity: out }}>
      <At x={plot.cx} y={plot.cy} style={{ transform: `scale(${dot})` }}>
        <HeadingLine length={150} angle={HEADING} color={C.amber} width={5} draw={draw} />
        <PlayerDot size={24} />
      </At>
      <div
        style={{
          position: "absolute", left: plot.cx + 50 * s, top: plot.cy + 30 * s, font: `600 ${18 * s}px ${MONO}`, letterSpacing: "0.1em",
          color: C.amber, whiteSpace: "pre", textShadow: `0 0 10px ${amber(0.4)}`,
        }}
      >
        {read}
      </div>
      {frame >= SAFE.tag ? (
        <At x={plot.cx - 54 * s} y={plot.cy - 64 * s} style={{ transform: `scale(${lerp(0.6, 1, tag)})`, opacity: clamp(tag * 2), transformOrigin: "0 0" }}>
          <div
            style={{
              position: "absolute", right: 0, bottom: 0, padding: `${10 * s}px ${16 * s}px ${10 * s}px ${20 * s}px`, borderRadius: 10,
              background: rgba(C.panel, 0.9), border: `1px solid ${C.line2}`, boxShadow: `0 10px 30px rgba(0, 0, 0, 0.5)`, whiteSpace: "nowrap",
            }}
          >
            <div style={{ position: "absolute", left: 0, top: 8, bottom: 8, width: 4, borderRadius: "0 3px 3px 0", background: C.amber }} />
            <div style={{ font: `700 ${40 * s}px/1 ${COND}`, color: C.fg, letterSpacing: "0.01em" }}>CUSTOMS</div>
            <div style={{ font: `500 ${14 * s}px ${MONO}`, color: C.muted, letterSpacing: "0.12em", marginTop: 6 * s }}>GAME LOG · bigmap</div>
          </div>
        </At>
      ) : null}
    </div>
  );
};

// ---- scene ------------------------------------------------------------------------------------------------

/** The header and a status line that re-decodes at each step. */
const Status = ({ frame, L }: { frame: number; L: Layout }) => {
  const [at, text] = [...STATUS].reverse().find(([f]) => frame >= f) ?? STATUS[0];
  const shown = at === 0 ? typed(text, prog(frame, 6, 18)) : scramble(text, prog(frame, at, at + 8), frame, 17);
  const out = 1 - prog(frame, SAFE.headline[0] - 6, SAFE.headline[0] + 4);
  const { x, y, size } = L.header;
  return (
    <div style={{ position: "absolute", left: x, top: y, opacity: out }}>
      <div style={{ font: `500 ${size}px ${MONO}`, letterSpacing: "0.16em", color: C.amber }}>{typed("// HOW TARTRAK WORKS", prog(frame, 0, 12))}</div>
      <div style={{ font: `600 ${size * 1.1}px ${MONO}`, letterSpacing: "0.12em", color: C.fg, marginTop: 10, whiteSpace: "pre" }}>
        <span style={{ color: frame >= SAFE.lock ? C.ok : C.amber }}>{frame % 40 < 26 || frame >= SAFE.lock ? "■" : " "}</span> {shown}
      </div>
    </div>
  );
};

/**
 * Scene 5, HOW IT WORKS (local 0-359). In raid, PRT SC goes down and the shutter freezes the view into a
 * screenshot whose filename decodes; a read head picks out X, Y, Z and the rotation, the rest of the name
 * falls away, and the fields drop into decoder cells that translate them (metres, ground level, a compass
 * spinning onto 048°). X and Z swing out into a grid's axes, their lines meet on the compass, the reticle
 * locks and the map comes up under my marker, named from the game log. "IT NEVER TOUCHES THE GAME." lands
 * over it.
 */
export const Safe = () => {
  const frame = useCurrentFrame();
  const { W, H, portrait } = useLayout();
  const L = layoutFor(W, H, portrait);
  const mapIn = prog(frame, SAFE.map[0], SAFE.map[1], easeOutCubic) * (1 - prog(frame, SAFE.out, SAFE.out + 16));
  const dim = prog(frame, SAFE.headline[0] - 4, SAFE.headline[0] + 10);
  const cam = {
    x: ME.x,
    y: ME.y,
    zoom: track(frame, [[SAFE.map[0], 1.4, easeOutCubic], [SAFE.map[1], 1.7, linear], [SAFE.out + 16, 2.1]]),
    tilt: track(frame, [[SAFE.map[1], 0], [SAFE.out + 16, 34]]),
    turn: track(frame, [[SAFE.map[1], 0], [SAFE.out + 16, -12]]),
  };
  const caption = typed(CAPTION, prog(frame, SAFE.caption, SAFE.caption + 30));
  const keyOut = prog(frame, SAFE.release + 2, SAFE.release + 14, easeInCubic);
  return (
    <AbsoluteFill>
      {mapIn > 0 ? (
        <AbsoluteFill style={{ opacity: mapIn, filter: `brightness(${lerp(1, 0.72, dim)})` }}>
          <SettledWorld cam={cam} width={W} height={H} show={{ ...BARE, mates: false }} />
        </AbsoluteFill>
      ) : null}
      <GameView frame={frame} L={L} />
      {frame < SAFE.release + 14 ? (
        <div style={{ position: "absolute", inset: 0, opacity: 1 - keyOut, transform: `translateY(${keyOut * 40}px)` }}>
          <Keycap label="PRT SC" sub="SCREENSHOT" x={L.key.x} y={L.key.y} size={L.key.size} appearAt={SAFE.key} pressAt={SAFE.press} releaseAt={SAFE.release} />
        </div>
      ) : null}
      {FIELDS.map((_, k) => (
        <Cell key={k} k={k} frame={frame} L={L} portrait={portrait} />
      ))}
      <Plot frame={frame} L={L} W={W} H={H} />
      <Brackets frame={frame} L={L} />
      <NameChars frame={frame} L={L} />
      <ReadHead frame={frame} L={L} />
      <Lock frame={frame} L={L} portrait={portrait} />
      <Status frame={frame} L={L} />
      <EdgeScrim side="bottom" size={portrait ? 900 : 560} opacity={dim * (1 - prog(frame, SAFE.out, SAFE.out + 14))} />
      <Headline
        lines={[{ text: "IT NEVER TOUCHES", accent: "NEVER" }, { text: "THE GAME." }]}
        at={[...SAFE.headline]}
        out={SAFE.out}
        x={W / 2}
        y={L.hl.y}
        size={L.hl.size}
        align="center"
      />
      {frame >= SAFE.caption ? (
        <div
          style={{
            position: "absolute", left: 0, width: W, top: L.hl.caption, textAlign: "center", padding: "0 60px", boxSizing: "border-box",
            font: `500 ${portrait ? 24 : 22}px ${MONO}`, letterSpacing: "0.14em", color: C.fg2, opacity: 1 - prog(frame, SAFE.out, SAFE.out + 10),
          }}
        >
          {caption}
        </div>
      ) : null}
      <ShutterIris at={SAFE.shutter} cx={L.view.cx} cy={L.view.cy} />
    </AbsoluteFill>
  );
};

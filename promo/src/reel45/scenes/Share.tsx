import { AbsoluteFill, spring, useCurrentFrame } from "remotion";
import { MONO, SANS } from "../../fonts.ts";
import { C, SPRING_POP } from "../../theme.ts";
import { clamp, easeInCubic, easeInOutCubic, easeOutCubic, lerp, prog } from "../../lib/ease.ts";
import { typed } from "../../lib/text.ts";
import { Icon } from "../../components/ui.tsx";
import { Headline } from "../../components/Headline.tsx";
import { PinGlyph } from "../../components/Markers.tsx";
import { Ping } from "../../components/Ping.tsx";
import { project, type Cam } from "../../world/camera.ts";
import { MATES, ME, fromBearing, mateLabel, type Pt } from "../../world/data.ts";
import { SHARE } from "../timeline.ts";
import { At, BARE, SettledWorld, mixHex, rgba, useLayout } from "../kit.tsx";

/** The spot I mark: 70 m out towards VEX. */
const TARGET: Pt = fromBearing(ME, 20, 70);
const LABEL = "SNIPER, ROOF";
const GHOST = MATES.find((m) => m.id === "ghost")!;
const NOMAD = MATES.find((m) => m.id === "nomad")!;
const PLAYERS = [
  { name: "YOU", color: C.amber, at: ME as Pt },
  { name: mateLabel(GHOST), color: GHOST.color, at: GHOST as Pt },
  { name: mateLabel(NOMAD), color: NOMAD.color, at: NOMAD as Pt },
] as const;
const HEADER = 44;

type Box = { x: number; y: number; w: number; h: number };
function panels(W: number, H: number, portrait: boolean): Box[] {
  if (portrait) {
    const w = W - 120, h = 400, gap = 28, top = 150;
    return [0, 1, 2].map((k) => ({ x: 60, y: top + k * (h + gap), w, h }));
  }
  const w = 540, h = 600, gap = 40;
  const left = (W - 3 * w - 2 * gap) / 2;
  return [0, 1, 2].map((k) => ({ x: left + k * (w + gap), y: 120, w, h }));
}
/** Each player's map follows them, the way "follow me" does. */
const camFor = (k: number, frame: number): Cam => {
  const p = PLAYERS[k].at;
  // The map between them and the marked spot, drifting a little.
  return { x: lerp(p.x, TARGET.x, 0.35) + frame * 0.05, y: lerp(p.y, TARGET.y, 0.35), zoom: 1.15, tilt: 0, turn: 0 };
};

/** My drawing: a hand-drawn loop round the marked spot, a little over one turn, in world units. */
const STROKE: Pt[] = Array.from({ length: 64 }, (_, i) => {
  const t = i / 63;
  const a = (-110 + t * 410) * (Math.PI / 180);
  const r = 1 + 0.06 * Math.sin(t * 17) + 0.12 * t;
  // Wide enough to take in the pin's label.
  return { x: TARGET.x + Math.cos(a) * r * 78, y: TARGET.y + Math.sin(a) * r * 48 };
});

const MENU = ["Marker for me", "Shared marker", "Go here"] as const;

/** The app's right-click menu: a label field, then three items; "Shared marker" lights up on hover. */
const Menu = ({ frame, x, y }: { frame: number; x: number; y: number }) => {
  if (frame < SHARE.menu || frame > SHARE.click + 6) return null;
  const open = easeOutCubic(prog(frame, SHARE.menu, SHARE.menu + 7));
  const close = prog(frame, SHARE.click + 1, SHARE.click + 6, easeInCubic);
  const text = typed(LABEL, prog(frame, SHARE.typeFrom, SHARE.typeTo));
  const caret = frame < SHARE.hover && Math.floor(frame / 15) % 2 === 0;
  const hover = frame >= SHARE.hover;
  const press = frame >= SHARE.click - 2;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: 250,
        padding: 6,
        borderRadius: 10,
        background: C.raised,
        border: `1px solid ${C.line2}`,
        boxShadow: "0 12px 40px rgba(0, 0, 0, 0.6)",
        font: `500 16px ${SANS}`,
        color: C.fg,
        transformOrigin: "0 0",
        transform: `scale(${lerp(0.92, 1, open) - close * 0.04})`,
        opacity: open * (1 - close),
      }}
    >
      <div
        style={{
          height: 38,
          lineHeight: "38px",
          padding: "0 10px",
          borderRadius: 6,
          background: C.deep,
          border: `1px solid ${frame < SHARE.hover ? C.amber : C.line2}`,
          font: `500 15px ${MONO}`,
          color: text ? C.fg : C.muted,
          marginBottom: 6,
          whiteSpace: "pre",
        }}
      >
        {text || "Label (optional)"}
        {caret ? <span style={{ color: C.amber }}>|</span> : null}
      </div>
      {MENU.map((item, i) => {
        const on = i === 1 && hover;
        return (
          <div
            key={item}
            style={{
              height: 36,
              lineHeight: "36px",
              padding: "0 10px",
              borderRadius: 6,
              background: on ? (press ? rgba(C.amber, 0.3) : C.amberSoft) : "transparent",
              color: on ? C.amber : C.fg2,
            }}
          >
            {item}
          </div>
        );
      })}
    </div>
  );
};

/** An arrow pointer with its tip at (0, 0). */
const Cursor = ({ pressed }: { pressed: boolean }) => (
  <svg width={30} height={40} viewBox="0 0 24 32" style={{ position: "absolute", left: -2, top: -2, overflow: "visible", transform: `scale(${pressed ? 0.88 : 1})`, transformOrigin: "2px 2px" }}>
    <path d="M2 2 L2 26 L8 20 L12.5 30 L16.5 28.2 L12 18.5 L20 18.5 Z" fill="#fff" stroke="#000" strokeWidth={1.6} strokeLinejoin="round" />
  </svg>
);

/**
 * Scene 9, SHARED MARKERS (local 0-359). Three screens side by side (stacked in the vertical cut): mine,
 * GHOST's and NOMAD's maps. I right-click, type a label and pick "Shared marker"; the pin drops on my map
 * and flies to theirs, landing in my colour on each. Then the pencil turns on and I circle the pin; the
 * stroke draws on their screens as I draw it. "MARK IT. DRAW IT. YOUR SQUAD SEES IT."
 */
export const Share = () => {
  const frame = useCurrentFrame();
  const { W, H, portrait } = useLayout();
  const boxes = panels(W, H, portrait);
  const leave = prog(frame, SHARE.out, SHARE.out + 14, easeOutCubic);
  // Where the target lands in each panel, in frame coordinates.
  const pins = boxes.map((b, k) => {
    const p = project(camFor(k, frame), TARGET, b.w, b.h - HEADER);
    return { x: b.x + p.x, y: b.y + HEADER + p.y };
  });
  const b0 = boxes[0];
  const cursorFrom = { x: b0.x + b0.w * 0.85, y: b0.y + b0.h * 0.95 };
  const cursorT = easeInOutCubic(prog(frame, SHARE.cursor, SHARE.menu - 4));
  const cursorAway = easeInOutCubic(prog(frame, SHARE.click + 6, SHARE.click + 30));
  const menuPos = { x: pins[0].x + 14, y: pins[0].y + 8 };
  // The cursor travels to the spot, then down onto "Shared marker", then off to the side.
  const shared = { x: menuPos.x + 120, y: menuPos.y + 6 + 38 + 6 + 36 + 18 };
  const cur =
    frame < SHARE.typeTo
      ? { x: lerp(cursorFrom.x, pins[0].x, cursorT), y: lerp(cursorFrom.y, pins[0].y, cursorT) }
      : frame < SHARE.click + 6
        ? (() => {
            const t = easeInOutCubic(prog(frame, SHARE.typeTo, SHARE.hover));
            return { x: lerp(pins[0].x, shared.x, t), y: lerp(pins[0].y, shared.y, t) };
          })()
        : { x: lerp(shared.x, shared.x + 90, cursorAway), y: lerp(shared.y, shared.y + 120, cursorAway) };
  // My stroke on each panel, as far as it has got there.
  const strokes = boxes.map((b, k) => {
    const u = prog(frame, SHARE.draw[0] + k * SHARE.lag, SHARE.draw[1] + k * SHARE.lag, easeInOutCubic);
    const n = Math.round(u * (STROKE.length - 1));
    const pts = STROKE.slice(0, n + 1).map((q) => {
      const p = project(camFor(k, frame), q, b.w, b.h - HEADER);
      return { x: b.x + p.x, y: b.y + HEADER + p.y };
    });
    return frame < SHARE.draw[0] + k * SHARE.lag ? [] : pts;
  });
  const pencil = frame < SHARE.pencil ? 0 : spring({ frame: frame - SHARE.pencil, fps: 60, config: SPRING_POP });
  const nib = strokes[0][strokes[0].length - 1];
  const pressed = (frame >= SHARE.menu - 3 && frame < SHARE.menu + 2) || (frame >= SHARE.click - 2 && frame < SHARE.click + 3);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ opacity: 1 - leave }}>
        {boxes.map((b, k) => {
          const enter = spring({ frame: frame - SHARE.panels[k], fps: 60, config: SPRING_POP });
          const arrive = SHARE.arrive[k];
          const flash = frame >= arrive ? 1 - prog(frame, arrive, arrive + 20) : 0;
          const p = PLAYERS[k];
          return (
            <div
              key={k}
              style={{
                position: "absolute",
                left: b.x,
                top: b.y,
                width: b.w,
                height: b.h,
                borderRadius: 14,
                overflow: "hidden",
                background: C.panel,
                border: `2px solid ${flash > 0 ? mixHex(C.line2, C.amber, flash) : C.line2}`,
                boxShadow: `0 20px 60px rgba(0, 0, 0, 0.55)${flash > 0 ? `, 0 0 ${40 * flash}px ${rgba(C.amber, 0.5 * flash)}` : ""}`,
                opacity: clamp(enter * 1.5),
                transform: `translateY(${(1 - enter) * 80}px)`,
              }}
            >
              <div
                style={{
                  height: HEADER,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "0 16px",
                  background: C.raised,
                  borderBottom: `1px solid ${C.line}`,
                  font: `600 16px ${MONO}`,
                  letterSpacing: "0.12em",
                  color: C.fg,
                }}
              >
                <span style={{ width: 12, height: 12, borderRadius: "50%", background: p.color, boxShadow: `0 0 10px ${p.color}` }} />
                {p.name}
                <span style={{ marginLeft: "auto", color: C.muted, fontSize: 13 }}>ROOM K7Q2XM</span>
              </div>
              <div style={{ position: "relative", width: b.w, height: b.h - HEADER }}>
                <SettledWorld cam={camFor(k, frame)} width={b.w} height={b.h - HEADER} show={BARE} extrude={0} />
              </div>
            </div>
          );
        })}
        {/* The marker travelling from my screen to theirs. */}
        <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
          {[1, 2].map((k) => {
            const from = pins[0], to = pins[k];
            const t0 = SHARE.arrive[0], t1 = SHARE.arrive[k];
            if (frame < t0 || frame > t1 + 14) return null;
            const t = easeInOutCubic(prog(frame, t0, t1));
            const lift = portrait ? { x: -260, y: 0 } : { x: 0, y: -220 };
            const ctrl = { x: (from.x + to.x) / 2 + lift.x, y: (from.y + to.y) / 2 + lift.y };
            const at = (u: number) => ({
              x: (1 - u) ** 2 * from.x + 2 * (1 - u) * u * ctrl.x + u * u * to.x,
              y: (1 - u) ** 2 * from.y + 2 * (1 - u) * u * ctrl.y + u * u * to.y,
            });
            const head = at(t);
            const tail = Array.from({ length: 12 }, (_, i) => at(Math.max(0, t - (i + 1) * 0.025)));
            const fade = 1 - prog(frame, t1, t1 + 14);
            return (
              <g key={k} opacity={fade}>
                <path d={`M ${from.x} ${from.y} Q ${ctrl.x} ${ctrl.y} ${to.x} ${to.y}`} fill="none" stroke={rgba(C.amber, 0.25)} strokeWidth={2} strokeDasharray="6 8" />
                {tail.map((p, i) => (
                  <circle key={i} cx={p.x} cy={p.y} r={7 - i * 0.5} fill={rgba(C.amber, 0.5 - i * 0.04)} />
                ))}
                <circle cx={head.x} cy={head.y} r={9} fill={C.amber} style={{ filter: `drop-shadow(0 0 10px ${C.amber})` }} />
              </g>
            );
          })}
        </svg>
        {pins.map((p, k) => {
          const at = SHARE.arrive[k];
          if (frame < at) return null;
          const drop = spring({ frame: frame - at, fps: 60, config: SPRING_POP });
          return (
            <div key={k}>
              <Ping at={at} cx={p.x} cy={p.y} maxR={110} dur={34} width={3} />
              <At x={p.x} y={p.y} style={{ transform: `translateY(${(1 - drop) * -40}px)`, opacity: clamp(drop * 2) }}>
                <PinGlyph color={C.amber} size={44} />
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 10,
                    transform: "translateX(-50%)",
                    padding: "4px 10px",
                    borderRadius: 6,
                    background: "rgba(15, 19, 24, 0.9)",
                    border: `1px solid ${rgba(C.amber, 0.6)}`,
                    font: `600 14px ${MONO}`,
                    letterSpacing: "0.08em",
                    color: C.amber,
                    whiteSpace: "nowrap",
                  }}
                >
                  {LABEL}
                </div>
              </At>
            </div>
          );
        })}
        <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0 }}>
          {strokes.map((pts, k) =>
            pts.length > 1 ? (
              <polyline
                key={k}
                points={pts.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="none"
                stroke={C.amber}
                strokeWidth={5}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ filter: `drop-shadow(0 0 6px ${rgba(C.amber, 0.7)})` }}
              />
            ) : null,
          )}
        </svg>
        {/* The draw button on my map, lit once the pencil is on. */}
        {pencil > 0 ? (
          <div
            style={{
              position: "absolute",
              left: b0.x + b0.w - 132,
              top: b0.y + HEADER + 14,
              display: "flex",
              alignItems: "center",
              gap: 8,
              height: 36,
              padding: "0 14px",
              borderRadius: 18,
              background: C.amber,
              color: C.onAmber,
              font: `700 15px ${MONO}`,
              letterSpacing: "0.12em",
              transform: `scale(${pencil})`,
            }}
          >
            <Icon name="draw" size={18} />
            DRAW
          </div>
        ) : null}
        {nib && frame <= SHARE.draw[1] + 10 ? (
          <At x={nib.x} y={nib.y} style={{ opacity: 1 - prog(frame, SHARE.draw[1], SHARE.draw[1] + 10) }}>
            <div style={{ position: "absolute", left: -2, top: -26, color: "#fff", filter: "drop-shadow(0 2px 3px #000)" }}>
              <Icon name="draw" size={28} />
            </div>
          </At>
        ) : null}
        <Menu frame={frame} x={menuPos.x} y={menuPos.y} />
        {frame >= SHARE.cursor && frame < SHARE.click + 32 ? (
          <At x={cur.x} y={cur.y} style={{ opacity: 1 - prog(frame, SHARE.click + 20, SHARE.click + 32) }}>
            <Cursor pressed={pressed} />
          </At>
        ) : null}
      </AbsoluteFill>
      <Headline
        lines={[{ text: "MARK IT. DRAW IT." }, { text: "YOUR SQUAD SEES IT.", accent: "SQUAD" }]}
        at={[...SHARE.headline]}
        out={SHARE.out}
        x={W / 2}
        y={portrait ? H - 170 : H - 80}
        size={portrait ? 96 : 104}
        align="center"
      />
    </AbsoluteFill>
  );
};

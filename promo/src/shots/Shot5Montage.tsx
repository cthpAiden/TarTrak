import { AbsoluteFill, spring, useCurrentFrame } from "remotion";
import { Chip } from "../components/Chip.tsx";
import { Glitch } from "../components/Glitch.tsx";
import { Keycap } from "../components/Keycap.tsx";
import { Icon } from "../components/ui.tsx";
import { COND, SANS } from "../fonts.ts";
import { easeOutCubic, easeOutExpo, prog } from "../lib/ease.ts";
import { typed } from "../lib/text.ts";
import { C, SPRING_POP } from "../theme.ts";
import { HANDOFF } from "../timeline.ts";
import { project, type Cam } from "../world/camera.ts";
import { STROKE } from "../world/data.ts";
import { World, type WorldShow } from "../world/World.tsx";
import { CUTS, cutAt, drawCam, drawScale, irisRadius, markCam, questsCam, routeCam, strokeHead } from "./montage/montage.ts";
import { QuestCard } from "./montage/QuestCard.tsx";
import { BigWord, Counter, CutFlash } from "./montage/Word.tsx";

const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};
const pop = (frame: number, at: number) => (frame < at ? 0 : spring({ frame: frame - at, fps: 60, config: SPRING_POP }));

/**
 * The World through a screen camera, drawn at 1/k size and scaled k times: markers, labels and line
 * weights read k times larger (the close-ups' hero scale). DRAW eases k back to 1 by f599, because
 * shot 6 draws its minimap World at screen resolution.
 */
const HeroWorld = ({ cam, k = 1, x = 0, w = 1920, show }: { cam: Cam; k?: number; x?: number; w?: number; show?: WorldShow }) => (
  <div style={{ position: "absolute", left: x, top: 0, width: w / k, height: 1080 / k, transform: k === 1 ? undefined : `scale(${k})`, transformOrigin: "0 0" }}>
    <World cam={{ ...cam, zoom: cam.zoom / k }} width={w / k} height={1080 / k} show={show} extrude={0} />
  </div>
);

// ---- 01 ROUTE ------------------------------------------------------------------------------------

const RouteCut = ({ frame }: { frame: number }) => {
  const chip = prog(frame, 483, 494, easeOutExpo);
  const metres = Math.round(412 * easeOutCubic(prog(frame, 480, 498)));
  return (
    <>
      {/* area labels off: RAIL YARD drifted through the outlined word as the camera glides */}
      <HeroWorld cam={routeCam(frame)} k={1.5} show={{ labels: false }} />
      <div style={{ position: "absolute", right: 106, bottom: 110, opacity: chip, transformOrigin: "100% 100%", transform: `translateX(${(1 - chip) * 48}px) scale(1.75)` }}>
        <Chip color={C.amber}>
          NORTH GATE
          <span style={{ color: C.muted }}>·</span>
          <span style={{ color: C.amber, fontWeight: 600 }}>{`${String(metres).padStart(3, "\u2007")} m`}</span>
        </Chip>
      </div>
    </>
  );
};

// ---- 02 QUESTS -----------------------------------------------------------------------------------

/** The map takes the right 55% of the frame; its centre is zone q1. */
const SPLIT = 864;
const MAP_MID = { x: SPLIT + (1920 - SPLIT) / 2, y: 540 };

const QuestBadge = ({ frame }: { frame: number }) => {
  const at = 522;
  if (frame < at) return null;
  const s = pop(frame, at);
  const ring = prog(frame, at, at + 14);
  const label = typed("Supply Run", prog(frame, at + 3, at + 11));
  return (
    <div style={{ position: "absolute", left: MAP_MID.x, top: MAP_MID.y }}>
      {ring < 1 ? (
        <div style={{ position: "absolute", left: -60, top: -60, width: 120, height: 120, borderRadius: "50%", border: `2px solid ${C.ok}`, opacity: 1 - ring, transform: `scale(${0.35 + 0.65 * easeOutCubic(ring)})` }} />
      ) : null}
      <div
        style={{
          position: "absolute", left: -22, top: -22, width: 44, height: 44, borderRadius: 10, background: C.ok, border: `2px solid ${C.deep}`,
          display: "grid", placeItems: "center", color: C.deep, transform: `scale(${s})`, boxShadow: `0 0 26px ${rgba(C.ok, 0.5)}, 0 4px 10px ${rgba(C.deep, 0.6)}`,
        }}
      >
        <Icon name="quests" size={24} />
      </div>
      {label ? (
        <div
          style={{
            position: "absolute", left: 0, top: 36, transform: "translateX(-50%)", whiteSpace: "nowrap", padding: "5px 12px", borderRadius: 7,
            background: rgba(C.deep, 0.8), border: `1px solid ${rgba(C.ok, 0.45)}`, color: C.fg, font: `600 20px ${SANS}`, letterSpacing: "0.02em",
          }}
        >
          {label}
        </div>
      ) : null}
    </div>
  );
};

const QuestsCut = ({ frame }: { frame: number }) => (
  <>
    {/* teammates off in this close-up: NOMAD's label would pull the eye from the zone */}
    <HeroWorld cam={questsCam(frame)} k={2} x={SPLIT} w={1920 - SPLIT} show={{ mates: false }} />
    {/* the panel side casts a soft shadow onto the map, with a hairline edge */}
    <div style={{ position: "absolute", left: SPLIT, top: 0, width: 90, height: 1080, background: `linear-gradient(90deg, ${rgba(C.deep, 0.55)}, ${rgba(C.deep, 0)})` }} />
    <div style={{ position: "absolute", left: SPLIT - 1, top: 0, width: 1, height: 1080, background: C.line2 }} />
    <QuestBadge frame={frame} />
  </>
);

// ---- 03 MARK -------------------------------------------------------------------------------------

const KEY_Y = 820;
const MarkKeys = ({ frame }: { frame: number }) => {
  const chord = pop(frame, 546);
  return (
    <>
      <Keycap label="ALT" x={1260} y={KEY_Y} size={140} appearAt={526} pressAt={540} releaseAt={Infinity} />
      <div
        style={{
          position: "absolute", left: 1360, top: KEY_Y + 6, transform: `translate(-50%, -50%) scale(${frame >= 546 ? 1 + 0.35 * (1 - chord) : 1})`,
          font: `600 56px/1 ${COND}`, color: frame >= 546 ? C.amber : C.muted, textShadow: frame >= 546 ? `0 0 14px ${rgba(C.amber, 0.6)}` : undefined,
        }}
      >
        +
      </div>
      <Keycap label="V" x={1460} y={KEY_Y} size={140} appearAt={526} pressAt={546} releaseAt={556} />
    </>
  );
};

/**
 * Only me and the pin in this close-up: teammates sat on the word, zone arcs in the corners, and the
 * route's thick amber dashes competed with the pin.
 */
const MarkCut = ({ frame }: { frame: number }) => <HeroWorld cam={markCam(frame)} k={2} show={{ mates: false, quests: false, route: false }} />;

// ---- 04 DRAW -------------------------------------------------------------------------------------

/** A glowing pen tip riding the head of NOMAD's stroke. */
const PenTip = ({ frame, cam }: { frame: number; cam: Cam }) => {
  if (frame < STROKE.drawFrom || frame > STROKE.drawTo + 3) return null;
  const p = project(cam, strokeHead(frame), 1920, 1080);
  const o = prog(frame, STROKE.drawFrom, STROKE.drawFrom + 2) * (1 - prog(frame, STROKE.drawTo, STROKE.drawTo + 3));
  return (
    <div style={{ position: "absolute", left: p.x, top: p.y, opacity: o }}>
      <div style={{ position: "absolute", left: -44, top: -44, width: 88, height: 88, borderRadius: "50%", background: `radial-gradient(circle, ${rgba(C.nomad, 0.55)} 0%, ${rgba(C.nomad, 0.18)} 35%, ${rgba(C.nomad, 0)} 70%)` }} />
      <div style={{ position: "absolute", left: -8, top: -8, width: 16, height: 16, borderRadius: "50%", background: C.fg, boxShadow: `0 0 10px 3px ${rgba(C.nomad, 0.9)}` }} />
    </div>
  );
};

/** Everything outside the circle goes C.deep; the ring edge is a 2 px C.line2 hairline. */
const Iris = ({ r }: { r: number }) => {
  const { cx, cy } = HANDOFF.iris;
  const hole = `M${cx + r} ${cy}A${r} ${r} 0 1 0 ${cx - r} ${cy}A${r} ${r} 0 1 0 ${cx + r} ${cy}Z`;
  return (
    <svg width={1920} height={1080} style={{ position: "absolute", left: 0, top: 0 }}>
      <path d={`M0 0H1920V1080H0Z${hole}`} fill={C.deep} fillRule="evenodd" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.line2} strokeWidth={2} />
    </svg>
  );
};

const DrawCut = ({ frame }: { frame: number }) => {
  const cam = drawCam(frame);
  const r = irisRadius(frame);
  return (
    <>
      {/* area labels off: RIVERSIDE sat cropped on the right edge; none falls inside the hand-off circle */}
      <HeroWorld cam={cam} k={drawScale(frame)} show={{ labels: false }} />
      <PenTip frame={frame} cam={cam} />
      {r < Math.hypot(960, 540) ? <Iris r={r} /> : null}
    </>
  );
};

// ---- the shot ------------------------------------------------------------------------------------

/** The word and counter glitch out with the glitch hit at 596, so f599 is the clean hand-off circle. */
const TYPE_OUT = 596;
const typeGlitch = (frame: number) => (frame === TYPE_OUT ? 1 : frame === TYPE_OUT + 1 ? 0.6 : 0);

/**
 * Shot 5, MONTAGE (f480-599): four hard cuts on the beat (ROUTE, QUESTS, MARK, DRAW), each a close-up
 * with its own camera move, the giant outlined word filling amber and the "0N / 04" counter. DRAW ends
 * with an iris closing onto the map at the hand-off camera (HANDOFF.iris) for shot 6.
 */
export const Shot5Montage = () => {
  const frame = useCurrentFrame();
  const { index, local } = cutAt(frame);
  return (
    <AbsoluteFill>
      {index === 0 ? <RouteCut frame={frame} /> : null}
      {index === 1 ? <QuestsCut frame={frame} /> : null}
      {index === 2 ? <MarkCut frame={frame} /> : null}
      {index === 3 ? <DrawCut frame={frame} /> : null}
      {frame < TYPE_OUT + 2 ? (
        <Glitch amount={typeGlitch(frame)}>
          <AbsoluteFill style={{ opacity: frame === TYPE_OUT + 1 ? 0.45 : 1 }}>
            <BigWord word={CUTS[index].word} local={local} />
            <Counter index={index} local={local} />
          </AbsoluteFill>
        </Glitch>
      ) : null}
      {index === 1 ? <QuestCard frame={frame} x={106} y={714} /> : null}
      {index === 2 ? <MarkKeys frame={frame} /> : null}
      <CutFlash local={local} />
    </AbsoluteFill>
  );
};

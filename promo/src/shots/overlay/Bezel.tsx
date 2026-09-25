import { useId } from "react";
import { spring, useCurrentFrame } from "remotion";
import { MONO, SANS } from "../../fonts.ts";
import { C, SPRING_POP } from "../../theme.ts";
import { easeOutCubic, easeOutExpo, lerp, prog } from "../../lib/ease.ts";
import { EXTRACTS, ME, MATES, ROUTE_TARGET, bearingDeg } from "../../world/data.ts";
import {
  BOX, HDG, LABELS, MARK_AT, MINI, MINOR, boxAngle, boxSlide, flash, labelVis, minorAt, minorStart, pad3, polar, ringTurn, snapFrame, snapIn,
  stageAt,
} from "./shot6.ts";

const R = MINI.r;
const RO = MINI.ro;
/** Room round the ring for ticks flying in and marks dropping on. */
const PAD = 90;
const HALF = RO + PAD;
const LABEL_R = R + 9;
const BOX_R = (R + RO) / 2;

const NORTH_GATE = EXTRACTS.find((e) => e.id === ROUTE_TARGET)!;
/** The app's compass targets: teammates in their colours, the route in the accent. */
const TARGETS = [
  ...MATES.map((m) => ({ id: m.id, kind: "mate" as const, color: m.color, bearing: bearingDeg(ME, m), at: MARK_AT[m.id] })),
  { id: "route", kind: "route" as const, color: C.amber, bearing: bearingDeg(ME, NORTH_GATE), at: MARK_AT.route },
];

const spr = (frame: number, at: number, config = SPRING_POP) => (frame < at ? 0 : spring({ frame: frame - at, fps: 60, config }));

/**
 * The app's compass bezel (src/lib/map/CircleBezel.svelte) at its own sizes round the minimap disc,
 * assembling over 600-648: the band opens off the disc edge, 72 minor ticks fly in clockwise from N,
 * the majors and labels snap in by quadrant, the heading box slides round to 048° and the teammate and
 * route marks drop onto the rim. Heading-up (684-704) turns the ring under the box. Drawn in stage px,
 * centred on the minimap.
 */
export const Bezel = () => {
  const frame = useCurrentFrame();
  const uid = `bz${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const { s } = stageAt(frame);
  const turn = ringTurn(frame);
  const box = boxAngle(frame);
  const boxIn = prog(frame, BOX.appear, BOX.appear + 3);

  // The band opens outward off the disc on the impact; shot 5's iris edge (2 px C.line2) hands over to the app's hairlines.
  const open = easeOutExpo(prog(frame, 600, 607));
  const rOut = lerp(R, RO, open);
  const irisEdge = 1 - prog(frame, 600, 606);

  const minors = [];
  for (let k = 0; k < MINOR.n; k++) {
    const t = minorAt(frame, k);
    if (t.o <= 0) continue;
    const r1 = RO - 0.5 + t.off;
    // a glint as the tick seats, so a bright edge sweeps round with the ratchet
    const glint = flash(frame, minorStart(k) + 1.5, 7);
    minors.push(
      <g key={k} transform={`rotate(${k * 5})`} opacity={t.o}>
        {t.streak > 1 ? <line x1={0} y1={-r1} x2={0} y2={-(r1 + t.streak)} stroke={C.tickMinor} strokeOpacity={0.3} strokeWidth={1.2} /> : null}
        <line x1={0} y1={-r1} x2={0} y2={-(r1 - 5)} stroke={C.tickMinor} strokeWidth={1.2} />
        {glint > 0.02 ? <line x1={0} y1={-r1} x2={0} y2={-(r1 - 5)} stroke={C.fg} strokeOpacity={glint} strokeWidth={1.5} /> : null}
      </g>,
    );
  }

  // Majors slam in from just outside the band and flash on their quadrant's cue.
  const majors = [];
  const majorGlow = [];
  for (let i = 0; i < 12; i++) {
    const a = i * 30;
    const at = snapFrame(a);
    const p = snapIn(frame, at);
    if (p <= 0) continue;
    const off = 26 * (1 - p);
    const fl = flash(frame, at, 10);
    const line = (key: string, extra: object) => (
      <line key={key} transform={`rotate(${a})`} x1={0} y1={-(RO - 0.5 + off)} x2={0} y2={-(RO - 9.5 + off)} {...extra} />
    );
    majors.push(line(`m${a}`, { stroke: C.tick, strokeWidth: 2 + 0.8 * fl, opacity: Math.min(1, p * 1.6) }));
    if (fl > 0) majorGlow.push(line(`g${a}`, { stroke: C.fg, strokeWidth: 5, opacity: fl, filter: `url(#${uid}-glow)` }));
  }

  // Labels stay upright at their ring angle; they stamp in (big to size) on their quadrant's cue.
  const labels = LABELS.map((l) => {
    const at = snapFrame(l.deg);
    const p = snapIn(frame, at);
    if (p <= 0) return null;
    const a = l.deg + turn;
    const hide = 1 - boxIn * (1 - labelVis(a, box));
    if (hide <= 0) return null;
    const pos = polar(0, 0, LABEL_R, a);
    const fl = flash(frame, at, 12);
    const sc = lerp(1.9, 1, p) * (1 + 0.08 * fl);
    const fill = l.deg === 0 ? C.north : l.letter ? C.fg : C.fg2;
    const text = (key: string, extra: object) => (
      <text
        key={key}
        x={0}
        y={0}
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily={l.letter ? SANS : MONO}
        fontSize={l.letter ? 14 : 11}
        fontWeight={l.letter ? 700 : 500}
        fill={fill}
        {...extra}
      >
        {l.text}
      </text>
    );
    return (
      <g key={l.deg} transform={`translate(${pos.x} ${pos.y}) scale(${sc})`} opacity={Math.min(1, p * 1.4) * hide}>
        {fl > 0 ? text("glow", { opacity: fl, filter: `url(#${uid}-glow)`, stroke: fill, strokeWidth: 2 }) : null}
        {text("t", {})}
      </g>
    );
  });

  // Teammate triangles and the route diamond drop onto the disc edge from outside (SPRING_POP) at their bearings.
  const marks = TARGETS.map((t) => {
    if (frame < t.at) return null;
    const sp = spr(frame, t.at);
    const off = 42 * (1 - sp);
    const ring = prog(frame, t.at, t.at + 14);
    const shape =
      t.kind === "route" ? (
        <path d={`M0 ${-R - 2}l5.5 6.5-5.5 6.5-5.5-6.5z`} fill={C.bezel} stroke={t.color} strokeWidth={2} strokeLinejoin="round" />
      ) : (
        <path d={`M-5.5 ${-R - 1}h11l-5.5 9z`} fill={t.color} stroke={C.deep} strokeWidth={1} strokeLinejoin="round" />
      );
    return (
      <g key={t.id} transform={`rotate(${t.bearing + turn})`}>
        {ring < 1 ? (
          <circle cx={0} cy={-R + 3} r={4 + 16 * easeOutCubic(ring)} fill="none" stroke={t.color} strokeWidth={1.5} opacity={0.9 * (1 - ring)} />
        ) : null}
        <g transform={`translate(0 ${-off})`} opacity={prog(frame, t.at, t.at + 2)}>
          {shape}
        </g>
      </g>
    );
  });

  // The heading box: pops in on N, slides round reading its angle, lands on 048° (the pop cue at 645) and rides the ring heading-up.
  let headingBox = null;
  if (frame >= BOX.appear) {
    const pos = polar(0, 0, BOX_R, box);
    const sc = spr(frame, BOX.appear) * (1 + 0.14 * flash(frame, BOX.land, 9));
    const glow = Math.max(flash(frame, BOX.land, 16), 0.6 * flash(frame, 700, 14));
    // Heading-up gains the app's amber tip under the box at 12 o'clock, growing down from the box as it arrives.
    const tip = spr(frame, 699);
    headingBox = (
      <>
        <g transform={`translate(${pos.x} ${pos.y}) scale(${sc})`}>
          {glow > 0 ? <rect x={-19} y={-9.5} width={38} height={19} rx={4} fill="none" stroke={C.amber} strokeWidth={3} opacity={glow} filter={`url(#${uid}-glow)`} /> : null}
          <rect x={-19} y={-9.5} width={38} height={19} rx={4} fill={C.bezel} stroke={C.amber} strokeWidth={1.2} />
          <text x={0} y={0.5} textAnchor="middle" dominantBaseline="central" fontFamily={MONO} fontSize={11.5} fontWeight={700} fill={C.amber}>
            {pad3(Math.min(HDG, Math.max(0, boxSlide(frame))))}
          </text>
        </g>
        {tip > 0 ? (
          <path d="M-4.5 0h9l-4.5 6z" transform={`translate(0 ${-R - 5}) scale(${tip})`} fill={C.amber} stroke={C.deep} strokeWidth={0.8} strokeLinejoin="round" />
        ) : null}
      </>
    );
  }

  return (
    <svg
      width={2 * HALF}
      height={2 * HALF}
      viewBox={`${-HALF} ${-HALF} ${2 * HALF} ${2 * HALF}`}
      style={{ position: "absolute", left: MINI.x - HALF, top: MINI.y - HALF, overflow: "visible" }}
    >
      <defs>
        <filter id={`${uid}-glow`} x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation={2.4} />
        </filter>
      </defs>
      {open > 0 ? (
        <>
          <circle r={(R + rOut) / 2} fill="none" stroke={C.bezel} strokeOpacity={0.92} strokeWidth={rOut - R} />
          <circle r={rOut - 0.5} fill="none" stroke={C.fg} strokeOpacity={0.3} strokeWidth={1} />
        </>
      ) : null}
      <circle r={R} fill="none" stroke={C.fg} strokeOpacity={0.22 * (1 - irisEdge)} strokeWidth={1} />
      {irisEdge > 0 ? <circle r={R} fill="none" stroke={C.line2} strokeWidth={2 / s} opacity={irisEdge} /> : null}
      <g transform={`rotate(${turn})`}>
        {minors}
        {majorGlow}
        {majors}
      </g>
      {labels}
      {marks}
      {headingBox}
    </svg>
  );
};

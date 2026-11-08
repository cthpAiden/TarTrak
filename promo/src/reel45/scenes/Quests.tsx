import { AbsoluteFill, spring, useCurrentFrame } from "remotion";
import { MONO } from "../../fonts.ts";
import { C, SPRING_POP } from "../../theme.ts";
import { clamp, easeInOutCubic, easeOutCubic, lerp, prog } from "../../lib/ease.ts";
import { Headline } from "../../components/Headline.tsx";
import { Ping } from "../../components/Ping.tsx";
import { camAt, project3d, type Cam } from "../../world/camera.ts";
import { QUEST_ZONES, type Pt } from "../../world/data.ts";
import { CARD_HEAD, CARD_ROW, CARD_W, QuestCard } from "../../shots/montage/QuestCard.tsx";
import { QUESTS } from "../timeline.ts";
import { At, BARE, EdgeScrim, SettledWorld, rgba, useLayout } from "../kit.tsx";

const ZONE1 = QUEST_ZONES[0];
const ZONE2 = QUEST_ZONES[1];
const centre = (pts: readonly Pt[]): Pt => ({ x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length });

/**
 * The objectives, in pop order: Supply Run's zone then its item, Signal Lost's zone, Cold Storage's item.
 * `row` is the quest's row on the card, which the leader line starts from.
 */
type Objective = { row: number; at: Pt; zone?: readonly Pt[]; label: string };
const OBJECTIVES: readonly Objective[] = [
  { row: 0, at: centre(ZONE1.pts), zone: ZONE1.pts, label: "SUPPLY DROP AREA" },
  { row: 0, at: { x: 1700, y: 1270 }, label: "CRATE" },
  { row: 1, at: centre(ZONE2.pts), zone: ZONE2.pts, label: "FIND THE RADIO" },
  { row: 2, at: { x: 1990, y: 1010 }, label: "FREEZER KEY" },
];
/** NOMAD's quest marker: the app shows teammates' to-dos on your map too. */
const SQUAD_AT: Pt = { x: 1320, y: 1260 };

function cam(frame: number, portrait: boolean): Cam {
  const a: Cam = portrait ? { x: 1600, y: 1180, zoom: 0.7, tilt: 38, turn: -6 } : { x: 1440, y: 1140, zoom: 0.78, tilt: 38, turn: -6 };
  const b: Cam = portrait ? { x: 1580, y: 1140, zoom: 0.82, tilt: 46, turn: 4 } : { x: 1400, y: 1110, zoom: 0.92, tilt: 46, turn: 4 };
  return camAt(frame, [
    [0, a],
    [QUESTS.push[0], a],
    [QUESTS.push[1] + 60, b, easeInOutCubic],
    [360, { ...b, zoom: b.zoom * 1.04 }],
  ]);
}

/** A quest item marker, as the app draws them: an amber square tilted 45 degrees with a dark ring. */
const ItemMark = ({ color = C.amber, size }: { color?: string; size: number }) => (
  <div
    style={{
      position: "absolute",
      left: -size / 2,
      top: -size / 2,
      width: size,
      height: size,
      borderRadius: 4,
      background: color,
      border: `2px solid ${C.deep}`,
      boxShadow: `0 0 14px ${rgba(color, 0.6)}`,
      transform: "rotate(45deg)",
    }}
  />
);

const Tag = ({ text, color, size, below = false }: { text: string; color: string; size: number; below?: boolean }) => (
  <div
    style={{
      position: "absolute",
      left: below ? -30 : 22,
      top: below ? 24 : -14,
      height: 28,
      lineHeight: "28px",
      padding: "0 10px",
      borderRadius: 14,
      background: "rgba(15, 19, 24, 0.88)",
      border: `1px solid ${rgba(color, 0.6)}`,
      font: `600 ${size}px ${MONO}`,
      letterSpacing: "0.08em",
      color,
      whiteSpace: "nowrap",
    }}
  >
    {text}
  </div>
);

/**
 * Scene 8, QUESTS (local 0-359). The app's Quests card rises over a dimmed, tilted map and three quests
 * tick onto the to-do list, one a beat, under "TICK THE JOB. / FIND IT." The map brightens and pushes in;
 * each quest's objectives pop on the map a beat apart, with a leader line from its row. Last, NOMAD's
 * quest marker pops in his colour: the squad's to-dos show too.
 */
export const Quests = () => {
  const frame = useCurrentFrame();
  const { W, H, portrait } = useLayout();
  const c = cam(frame, portrait);
  const P = (p: Pt) => project3d(c, p, 0, W, H);
  const leave = prog(frame, QUESTS.out, QUESTS.out + 14, easeOutCubic);
  const dim = lerp(0.62, 0.12, easeInOutCubic(prog(frame, QUESTS.push[0], QUESTS.push[1])));
  // The card: big at first, a little smaller once the map takes over.
  const shrink = easeInOutCubic(prog(frame, QUESTS.push[0], QUESTS.push[1]));
  const scale = portrait ? lerp(1.9, 1.6, shrink) : lerp(1.45, 1.2, shrink);
  const card = portrait ? { x: (W - CARD_W * scale) / 2, y: lerp(170, 150, shrink) } : { x: 130, y: lerp(200, 150, shrink) };
  const rowAt = (i: number) => ({ x: card.x + CARD_W * scale, y: card.y + (CARD_HEAD + CARD_ROW * (i + 0.5)) * scale });
  const tag = portrait ? 18 : 15;
  return (
    <AbsoluteFill>
      <SettledWorld cam={c} width={W} height={H} show={{ ...BARE, mates: false }} />
      <AbsoluteFill style={{ background: `rgba(11, 13, 16, ${dim})` }} />
      <AbsoluteFill style={{ opacity: 1 - leave }}>
        <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
          {OBJECTIVES.map((o, k) => {
            const at = QUESTS.pops[k];
            if (frame < at) return null;
            const p = P(o.at);
            const zone = o.zone?.map(P);
            const draw = easeOutCubic(prog(frame, at, at + 22));
            // The leader line from the quest's row, drawn on then faded to a thin trace.
            const from = rowAt(o.row);
            const lead = easeOutCubic(prog(frame, at - 6, at + 10));
            const end = { x: lerp(from.x, p.x, lead), y: lerp(from.y, p.y, lead) };
            const trace = 1 - 0.7 * prog(frame, at + 20, at + 40);
            const mid = { x: (from.x + p.x) / 2, y: Math.min(from.y, p.y) - 60 };
            return (
              <g key={k}>
                <path
                  d={`M ${from.x} ${from.y} Q ${mid.x} ${mid.y} ${end.x} ${end.y}`}
                  fill="none"
                  stroke={rgba(C.amber, 0.7 * trace)}
                  strokeWidth={2}
                  strokeDasharray="5 7"
                />
                {zone ? (
                  <polygon
                    points={zone.map((q) => `${q.x},${q.y}`).join(" ")}
                    fill={rgba(C.amber, 0.14 * draw)}
                    stroke={C.amber}
                    strokeWidth={3}
                    strokeDasharray="10 7"
                    pathLength={100}
                    style={{ strokeDashoffset: 0, opacity: draw, filter: `drop-shadow(0 0 8px ${rgba(C.amber, 0.5)})` }}
                  />
                ) : null}
              </g>
            );
          })}
        </svg>
        {OBJECTIVES.map((o, k) => {
          const at = QUESTS.pops[k];
          if (frame < at) return null;
          const p = P(o.at);
          const pop = spring({ frame: frame - at, fps: 60, config: SPRING_POP });
          return (
            <div key={k}>
              <Ping at={at} cx={p.x} cy={p.y} maxR={o.zone ? 120 : 80} dur={32} />
              <At x={p.x} y={p.y} style={{ transform: `scale(${pop})`, opacity: clamp(pop * 2) }}>
                {o.zone ? null : <ItemMark size={portrait ? 22 : 20} />}
                <Tag text={o.label} color={C.amber} size={tag} below={!!o.zone} />
              </At>
            </div>
          );
        })}
        {frame >= QUESTS.squad
          ? (() => {
              const p = P(SQUAD_AT);
              const pop = spring({ frame: frame - QUESTS.squad, fps: 60, config: SPRING_POP });
              return (
                <>
                  <Ping at={QUESTS.squad} cx={p.x} cy={p.y} maxR={90} color={C.nomad} dur={32} />
                  <At x={p.x} y={p.y} style={{ transform: `scale(${pop})`, opacity: clamp(pop * 2) }}>
                    <ItemMark color={C.nomad} size={portrait ? 22 : 20} />
                    <Tag text="NOMAD'S QUEST" color={C.nomad} size={tag} />
                  </At>
                </>
              );
            })()
          : null}
        <QuestCard frame={frame} x={card.x} y={card.y} at={QUESTS.panel[0]} ticks={QUESTS.ticks} scale={scale} drift={false} />
        {/* The squad chip under the card. */}
        {frame >= QUESTS.squad + 6 ? (
          <div
            style={{
              position: "absolute",
              left: portrait ? W / 2 : card.x,
              top: card.y + (CARD_HEAD + CARD_ROW * 3 + 30) * scale,
              transform: `translateX(${portrait ? "-50%" : "0"}) scale(${spring({ frame: frame - QUESTS.squad - 6, fps: 60, config: SPRING_POP })})`,
              transformOrigin: portrait ? "50% 50%" : "0 50%",
              display: "flex",
              alignItems: "center",
              gap: 10,
              height: 44,
              padding: "0 18px",
              borderRadius: 22,
              background: "rgba(15, 19, 24, 0.9)",
              border: `1px solid ${rgba(C.nomad, 0.7)}`,
              font: `600 ${portrait ? 22 : 18}px ${MONO}`,
              letterSpacing: "0.12em",
              color: C.nomad,
            }}
          >
            <span style={{ width: 12, height: 12, borderRadius: "50%", background: C.nomad }} />+ YOUR SQUAD'S QUESTS
          </div>
        ) : null}
      </AbsoluteFill>
      <EdgeScrim side="bottom" size={portrait ? 640 : 420} />
      <Headline
        lines={[{ text: "TICK THE JOB." }, { text: "FIND IT.", accent: "FIND IT." }]}
        at={[...QUESTS.headline]}
        out={QUESTS.out}
        x={portrait ? 80 : 130}
        y={portrait ? H - 240 : H - 110}
        size={portrait ? 140 : 140}
      />
    </AbsoluteFill>
  );
};

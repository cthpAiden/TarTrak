import { AbsoluteFill, spring, useCurrentFrame } from "remotion";
import { MONO } from "../../fonts.ts";
import { C, SPRING_POP } from "../../theme.ts";
import { clamp, easeInOutCubic, easeOutCubic, prog } from "../../lib/ease.ts";
import { Headline } from "../../components/Headline.tsx";
import { ExtractBadge } from "../../components/Markers.tsx";
import { Ping } from "../../components/Ping.tsx";
import { camAt, project3d, type Cam } from "../../world/camera.ts";
import { EXTRACTS, ME, ROUTE_TARGET, distM, extractColor, type ExtractKind } from "../../world/data.ts";
import { EXITS } from "../timeline.ts";
import { At, BARE, EdgeScrim, SettledWorld, lerpPt, rgba, useLayout } from "../kit.tsx";

const TARGET = EXTRACTS.find((e) => e.id === ROUTE_TARGET)!;
const METRES = Math.round(distM(ME, TARGET));
const LEGEND: ReadonlyArray<{ kind: ExtractKind; label: string }> = [
  { kind: "pmc", label: "PMC" },
  { kind: "scav", label: "SCAV" },
  { kind: "shared", label: "SHARED" },
];

function cam(frame: number, portrait: boolean): Cam {
  const end = lerpPt(ME, TARGET, 0.42);
  return camAt(frame, [
    [0, { x: ME.x + 60, y: ME.y - 90, zoom: portrait ? 1.1 : 1.3, tilt: 38, turn: -10 }],
    [300, { x: end.x, y: end.y + (portrait ? 0 : 60), zoom: portrait ? 0.62 : 0.66, tilt: 46, turn: 8 }, easeInOutCubic],
  ]);
}

/**
 * Scene 7, EXTRACTS (local 0-299). A tilted map pulls back while every extract pops in its kind's
 * colour (PMC green, Scav amber, shared blue) with a legend; then a dashed route runs from me to
 * NORTH GATE, its distance counting up to 412 m, under "KNOW YOUR WAY OUT."
 */
export const Exits = () => {
  const frame = useCurrentFrame();
  const { W, H, portrait } = useLayout();
  const c = cam(frame, portrait);
  const P = (p: { x: number; y: number }) => project3d(c, p, 0, W, H);
  const me = P(ME);
  const routeT = easeOutCubic(prog(frame, EXITS.route[0], EXITS.route[1]));
  const head = P(lerpPt(ME, TARGET, routeT));
  const arrived = frame >= EXITS.route[1];
  const leave = prog(frame, EXITS.out, EXITS.out + 14, easeOutCubic);
  const badge = portrait ? 34 : 30;
  return (
    <AbsoluteFill>
      <SettledWorld cam={c} width={W} height={H} show={{ ...BARE, mates: false }} />
      <AbsoluteFill style={{ opacity: 1 - leave }}>
        {frame >= EXITS.route[0] ? (
          <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0 }}>
            <line x1={me.x} y1={me.y} x2={head.x} y2={head.y} stroke={rgba(C.amber, 0.35)} strokeWidth={14} strokeLinecap="round" style={{ filter: "blur(6px)" }} />
            <line
              x1={me.x}
              y1={me.y}
              x2={head.x}
              y2={head.y}
              stroke={C.amber}
              strokeWidth={5}
              strokeDasharray="16 12"
              strokeDashoffset={-frame * 1.2}
              strokeLinecap="round"
            />
          </svg>
        ) : null}
        {EXTRACTS.map((e, k) => {
          const at = EXITS.pops[k];
          if (frame < at) return null;
          const p = P(e);
          const pop = spring({ frame: frame - at, fps: 60, config: SPRING_POP });
          const hit = e.id === TARGET.id && arrived ? 1 + 0.25 * (1 - prog(frame, EXITS.route[1], EXITS.route[1] + 16)) : 1;
          const col = extractColor(e.kind);
          return (
            <div key={e.id}>
              <Ping at={at} cx={p.x} cy={p.y} maxR={90} color={col} dur={30} />
              {e.id === TARGET.id ? <Ping at={EXITS.route[1]} cx={p.x} cy={p.y} maxR={160} color={C.amber} dur={40} width={3} /> : null}
              <At x={p.x} y={p.y} style={{ transform: `scale(${pop * hit})` }}>
                <ExtractBadge kind={e.kind} size={badge} />
                <div
                  style={{
                    position: "absolute",
                    left: badge * 0.75,
                    top: -13,
                    height: 26,
                    lineHeight: "26px",
                    padding: "0 10px",
                    borderRadius: 13,
                    background: "rgba(15, 19, 24, 0.86)",
                    border: `1px solid ${rgba(col, 0.6)}`,
                    font: `600 ${portrait ? 16 : 14}px ${MONO}`,
                    letterSpacing: "0.08em",
                    color: col,
                    whiteSpace: "nowrap",
                    opacity: clamp((frame - at - 4) / 6),
                  }}
                >
                  {e.name}
                </div>
              </At>
            </div>
          );
        })}
        {frame >= EXITS.route[0] ? (
          <At x={(me.x + head.x) / 2} y={(me.y + head.y) / 2 - 34}>
            <div
              style={{
                position: "absolute",
                transform: "translate(-50%, -50%)",
                padding: "8px 16px",
                borderRadius: 999,
                background: C.amber,
                color: C.onAmber,
                font: `700 ${portrait ? 30 : 26}px ${MONO}`,
                fontVariantNumeric: "tabular-nums",
                whiteSpace: "nowrap",
                boxShadow: `0 4px 20px ${rgba(C.amber, 0.4)}`,
              }}
            >
              {Math.round(METRES * routeT)} m
            </div>
          </At>
        ) : null}
        {/* Legend: each kind's chip pops with its first extract. */}
        <div style={{ position: "absolute", right: portrait ? 60 : 110, top: portrait ? 170 : 120, display: "flex", gap: 12 }}>
          {LEGEND.map(({ kind, label }) => {
            const first = EXITS.pops[EXTRACTS.findIndex((e) => e.kind === kind)];
            const s = frame < first ? 0 : spring({ frame: frame - first, fps: 60, config: SPRING_POP });
            return (
              <div
                key={kind}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  height: 44,
                  padding: "0 18px 0 14px",
                  borderRadius: 22,
                  background: "rgba(15, 19, 24, 0.86)",
                  border: `1px solid ${C.line2}`,
                  font: `600 18px ${MONO}`,
                  letterSpacing: "0.12em",
                  color: C.fg,
                  transform: `scale(${s})`,
                  opacity: clamp(s * 2),
                }}
              >
                <span style={{ width: 14, height: 14, borderRadius: 4, background: extractColor(kind) }} />
                {label}
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
      <EdgeScrim side="bottom" size={portrait ? 640 : 460} />
      <Headline
        lines={[{ text: "KNOW YOUR" }, { text: "WAY OUT.", accent: "WAY OUT." }]}
        at={[...EXITS.headline]}
        out={EXITS.out}
        x={portrait ? 80 : 120}
        y={portrait ? H - 240 : H - 120}
        size={portrait ? 140 : 150}
      />
    </AbsoluteFill>
  );
};

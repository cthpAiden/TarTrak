import { AbsoluteFill, Sequence, spring, useCurrentFrame } from "remotion";
import { MONO } from "../../fonts.ts";
import { C, SPRING_POP } from "../../theme.ts";
import { clamp, easeInCubic, easeInExpo, easeOutCubic, lerp, prog } from "../../lib/ease.ts";
import { Headline } from "../../components/Headline.tsx";
import { Keycap } from "../../components/Keycap.tsx";
import { GameBackdrop } from "../../shots/overlay/GameBackdrop.tsx";
import { ME } from "../../world/data.ts";
import { KEYS } from "../timeline.ts";
import { At, BARE, EdgeScrim, SettledWorld, rgba, useLayout } from "../kit.tsx";

const LABELS = [
  { key: "F5", does: "OVERLAY" },
  { key: "F6", does: "OPACITY" },
  { key: "F7", does: "HIDE" },
] as const;

/** Presses of key k so far, and the latest one (whose keycap is on screen). */
const pressesOf = (k: number) => KEYS.presses.filter(([key]) => key === k);

/**
 * The overlay's state from the presses: F5 brings it in, F6 halves its opacity and the next F6 restores
 * it, F7 hides it and the next F7 brings it back.
 */
function overlayState(frame: number): { shown: number; alpha: number } {
  const [, f5] = KEYS.presses[0];
  const [, f6a] = KEYS.presses[1], [, f6b] = KEYS.presses[2];
  const [, f7a] = KEYS.presses[3], [, f7b] = KEYS.presses[4];
  const inT = frame < f5 ? 0 : spring({ frame: frame - f5, fps: 60, config: SPRING_POP });
  const hide = prog(frame, f7a, f7a + 8, easeInCubic) - (frame < f7b ? 0 : spring({ frame: frame - f7b, fps: 60, config: SPRING_POP }));
  const alpha = 1 - 0.55 * (prog(frame, f6a, f6a + 6) - prog(frame, f6b, f6b + 6));
  return { shown: inT * (1 - clamp(hide, 0, 1)), alpha };
}

/**
 * Scene 10, HOTKEYS (local 0-299). Over the game, F5 / F6 / F7 keycaps press on the beat: F5 pops the
 * round minimap in, F6 dims it and brings it back, F7 hides it and brings it back. "THREE KEYS. FULL
 * CONTROL." The overlay shape setting turns the circle into the box and back. Then the keys drop away and the minimap rushes to fill the frame, into the montage.
 */
export const Keys = () => {
  const frame = useCurrentFrame();
  const { W, H, portrait } = useLayout();
  const { shown, alpha } = overlayState(frame);
  // The finale: the minimap flies to the centre and swells past the frame.
  const rush = prog(frame, KEYS.flyOff, 300, easeInExpo);
  const r0 = portrait ? 150 : 165;
  const home = portrait ? { x: W - 210, y: 320 } : { x: W - 300, y: 300 };
  const cx = lerp(home.x, W / 2, easeOutCubic(prog(frame, KEYS.flyOff, 300)));
  const cy = lerp(home.y, H / 2, easeOutCubic(prog(frame, KEYS.flyOff, 300)));
  const r = r0 * (1 + rush * 5);
  // Circle (0) to box (1) and back.
  const box = clamp(
    (frame < KEYS.shape[0] ? 0 : spring({ frame: frame - KEYS.shape[0], fps: 60, config: SPRING_POP })) -
      (frame < KEYS.shape[1] ? 0 : spring({ frame: frame - KEYS.shape[1], fps: 60, config: SPRING_POP })),
  );
  const bw = 2 * r * lerp(1, 1.35, box);
  const bh = 2 * r * lerp(1, 0.9, box);
  const shapeChip = prog(frame, KEYS.shape[0] - 14, KEYS.shape[0] - 4) * (1 - prog(frame, KEYS.shape[1] + 14, KEYS.shape[1] + 24));
  const scale = Math.max(W / 1920, H / 1080);
  const keySize = portrait ? 200 : 170;
  const keyY = portrait ? H - 470 : H - 260;
  const keyGap = portrait ? 300 : 230;
  const drop = prog(frame, KEYS.flyOff, KEYS.flyOff + 16, easeInCubic);
  const lastF6 = [...pressesOf(1)].reverse().find(([, p]) => frame >= p);
  const chip = lastF6 ? 1 - prog(frame, lastF6[1] + 20, lastF6[1] + 30) : 0;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ filter: `brightness(${1 - 0.3 * rush})` }}>
        <div style={{ position: "absolute", left: (W - 1920 * scale) / 2, top: (H - 1080 * scale) / 2, width: 1920, height: 1080, transform: `scale(${scale})`, transformOrigin: "0 0" }}>
          <Sequence from={-600} layout="none">
            <GameBackdrop />
          </Sequence>
        </div>
      </AbsoluteFill>
      <EdgeScrim side={portrait ? "bottom" : "left"} size={portrait ? 900 : 1000} />
      {/* The round overlay: the map in a disc with a thin compass ring. */}
      {shown > 0.001 ? (
        <div style={{ position: "absolute", left: 0, top: 0, opacity: alpha * clamp(shown * 1.4) }}>
          <div
            style={{
              position: "absolute",
              // The box keeps the circle's top-right corner, as the app's window does.
              left: cx + r - bw,
              top: cy - r,
              width: bw,
              height: bh,
              borderRadius: lerp(r, 14, box),
              overflow: "hidden",
              transform: `scale(${lerp(0.6, 1, shown)})`,
              boxShadow: `0 0 0 ${3 + rush * 4}px ${C.bezel}, 0 0 0 ${5 + rush * 6}px ${rgba(C.amber, 0.7)}, 0 16px 50px rgba(0, 0, 0, 0.6)`,
            }}
          >
            <SettledWorld cam={{ x: ME.x, y: ME.y, zoom: 0.55 * (r / r0) * (r0 / 165), tilt: 0, turn: 0 }} width={bw} height={bh} show={BARE} extrude={0} />
            {/* The box's compass tape along its top edge. */}
            {box > 0.01 ? (
              <svg width={bw} height={34} style={{ position: "absolute", left: 0, top: 0, opacity: clamp(box * 2 - 0.4) }}>
                <rect width={bw} height={34} fill="rgba(15, 19, 24, 0.82)" />
                {Array.from({ length: Math.ceil(bw / 16) + 1 }, (_, i) => (
                  <line key={i} x1={i * 16 - 6} y1={34} x2={i * 16 - 6} y2={i % 3 === 0 ? 20 : 27} stroke={rgba(C.tick, i % 3 === 0 ? 0.8 : 0.45)} strokeWidth={1.5} />
                ))}
                <rect x={bw / 2 - 30} y={4} width={60} height={20} rx={4} fill={C.amber} />
                <text x={bw / 2} y={19} textAnchor="middle" style={{ font: `700 14px ${MONO}` }} fill={C.onAmber}>
                  048°
                </text>
              </svg>
            ) : null}
          </div>
          {rush === 0 && box < 0.33 ? (
            <svg width={2 * r + 60} height={2 * r + 60} style={{ position: "absolute", left: cx - r - 30, top: cy - r - 30, transform: `scale(${lerp(0.6, 1, shown)})`, opacity: 1 - box * 3 }}>
              {Array.from({ length: 36 }, (_, i) => {
                const a = (i / 36) * Math.PI * 2 - Math.PI / 2;
                const big = i % 9 === 0;
                const o = r + 30, r1 = r + 10, r2 = r + (big ? 24 : 18);
                return (
                  <line key={i} x1={o + Math.cos(a) * r1} y1={o + Math.sin(a) * r1} x2={o + Math.cos(a) * r2} y2={o + Math.sin(a) * r2} stroke={i === 0 ? C.north : rgba(C.tick, big ? 0.9 : 0.5)} strokeWidth={big ? 3 : 1.5} />
                );
              })}
            </svg>
          ) : null}
        </div>
      ) : null}
      {chip > 0 ? (
        <At x={home.x} y={home.y + r0 + 54}>
          <div
            style={{
              position: "absolute",
              transform: "translateX(-50%)",
              padding: "8px 16px",
              borderRadius: 20,
              background: "rgba(15, 19, 24, 0.86)",
              border: `1px solid ${C.line2}`,
              font: `600 18px ${MONO}`,
              letterSpacing: "0.12em",
              color: C.fg,
              whiteSpace: "nowrap",
              opacity: chip,
            }}
          >
            OPACITY {Math.round(alpha * 100)}%
          </div>
        </At>
      ) : null}
      {shapeChip > 0 ? (
        <At x={home.x} y={home.y + r0 + 54}>
          <div
            style={{
              position: "absolute",
              transform: "translateX(-50%)",
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: 5,
              borderRadius: 22,
              background: "rgba(15, 19, 24, 0.9)",
              border: `1px solid ${C.line2}`,
              font: `600 18px ${MONO}`,
              letterSpacing: "0.12em",
              whiteSpace: "nowrap",
              opacity: shapeChip,
            }}
          >
            {(["CIRCLE", "BOX"] as const).map((name, k) => {
              const on = (box > 0.5 ? 1 : 0) === k;
              return (
                <span key={name} style={{ padding: "6px 16px", borderRadius: 17, background: on ? C.amber : "transparent", color: on ? C.onAmber : C.fg2 }}>
                  {name}
                </span>
              );
            })}
          </div>
        </At>
      ) : null}
      <AbsoluteFill style={{ opacity: 1 - drop, transform: `translateY(${drop * 140}px)` }}>
        {LABELS.map(({ key, does }, k) => {
          const x = W / 2 + (k - 1) * keyGap;
          const mine = pressesOf(k);
          // The keycap of the latest press that has started its 8-frame lift.
          let idx = 0;
          mine.forEach(([, p], i) => {
            if (frame >= p - 8) idx = i;
          });
          const [, press, release] = mine[idx];
          return (
            <div key={k}>
              <Keycap
                key={idx}
                label={key}
                x={x}
                y={keyY}
                size={keySize}
                appearAt={idx === 0 ? KEYS.appear[k] : -1000}
                pressAt={press}
                releaseAt={release}
              />
              <div
                style={{
                  position: "absolute",
                  left: x - keySize,
                  width: 2 * keySize,
                  top: keyY + keySize / 2 + 40,
                  textAlign: "center",
                  font: `600 ${portrait ? 26 : 22}px ${MONO}`,
                  letterSpacing: "0.16em",
                  color: frame >= press && frame < release + 10 ? C.amber : C.fg2,
                  opacity: prog(frame, KEYS.appear[k] + 6, KEYS.appear[k] + 14),
                }}
              >
                {does}
              </div>
            </div>
          );
        })}
      </AbsoluteFill>
      <Headline
        lines={[{ text: "THREE KEYS." }, { text: "FULL CONTROL.", accent: "CONTROL." }]}
        at={[...KEYS.headline]}
        out={KEYS.out}
        x={portrait ? 80 : 130}
        y={portrait ? H * 0.56 : 420}
        size={portrait ? 130 : 140}
      />
    </AbsoluteFill>
  );
};

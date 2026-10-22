import { AbsoluteFill, useCurrentFrame } from "remotion";
import { COND, MONO } from "../../fonts.ts";
import { C } from "../../theme.ts";
import { clamp, easeOutCubic, easeOutExpo, prog } from "../../lib/ease.ts";
import { typed } from "../../lib/text.ts";
import { Headline } from "../../components/Headline.tsx";
import { ME } from "../../world/data.ts";
import { MAPS } from "../timeline.ts";
import { BARE, EdgeScrim, SettledWorld, mixHex, rgba, useLayout } from "../kit.tsx";

/** The maps TarTrak ships (src/lib/map/mapsData.ts DISPLAY_NAMES), in the app's order. */
const NAMES = [
  "CUSTOMS", "FACTORY", "GROUND ZERO", "INTERCHANGE", "LIGHTHOUSE", "RESERVE", "SHORELINE",
  "STREETS OF TARKOV", "THE LAB", "THE LABYRINTH", "TERMINAL", "WOODS", "ICEBREAKER",
] as const;
/** Three full turns, landing on CUSTOMS. */
const TRAVEL = NAMES.length * 3;
const SUB = "READ FROM THE GAME'S OWN LOG";

/** Reel position in rows: fast off the start, a long slow landing. */
function reelPos(frame: number): number {
  return TRAVEL * easeOutExpo(prog(frame, MAPS.spinFrom, MAPS.land));
}

/**
 * Scene 6, MAPS (local 0-239). The drop: a slot-machine reel of all 13 map names spins over a blurred,
 * orbiting map and lands on CUSTOMS with an amber flash, beside "13 MAPS. AUTO-DETECTED."
 */
export const Maps = () => {
  const frame = useCurrentFrame();
  const { W, H, portrait } = useLayout();
  const p = reelPos(frame);
  const speed = Math.abs(reelPos(frame + 1) - p);
  const landed = frame >= MAPS.land;
  const landFlash = landed ? 1 - prog(frame, MAPS.land, MAPS.land + 18) : 0;
  const leave = prog(frame, MAPS.out, MAPS.out + 14, easeOutCubic);

  const rowH = portrait ? 104 : 92;
  const nameSize = portrait ? 76 : 60;
  const cx = portrait ? W / 2 : 1450;
  const cy = portrait ? H * 0.36 : H / 2;
  const bandW = portrait ? 920 : 680;
  const visible = 4;
  const rows = [];
  for (let i = Math.floor(p) - visible; i <= Math.floor(p) + visible; i++) {
    const d = i - p;
    const ad = Math.abs(d);
    if (ad > visible) continue;
    const name = NAMES[((i % NAMES.length) + NAMES.length) % NAMES.length];
    const centre = clamp(1 - ad);
    const hot = landed && i === TRAVEL;
    rows.push(
      <div
        key={i}
        style={{
          position: "absolute",
          left: cx - bandW / 2,
          width: bandW,
          top: cy + d * rowH - rowH / 2,
          height: rowH,
          lineHeight: `${rowH}px`,
          textAlign: "center",
          font: `700 ${nameSize}px ${COND}`,
          letterSpacing: "0.02em",
          color: hot ? mixHex(C.amber, "#ffffff", landFlash * 0.6) : C.fg,
          opacity: (0.18 + 0.82 * centre) * (1 - ad / (visible + 0.5)),
          transform: `scale(${0.8 + 0.2 * centre}) perspective(900px) rotateX(${-d * 14}deg)`,
          // Vertical smear while the reel is fast.
          textShadow: speed > 0.05 ? `0 ${-Math.min(40, speed * 60)}px 0 ${rgba(C.fg, 0.12)}, 0 ${Math.min(40, speed * 60)}px 0 ${rgba(C.fg, 0.12)}` : hot ? `0 0 ${30 * landFlash + 10}px ${rgba(C.amber, 0.5)}` : undefined,
        }}
      >
        {name}
      </div>,
    );
  }
  const sub = typed(SUB, prog(frame, MAPS.land + 8, MAPS.land + 28));
  const hlSize = portrait ? 128 : 124;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ filter: "blur(7px) brightness(0.5) saturate(0.8)", transform: "scale(1.05)" }}>
        <SettledWorld cam={{ x: ME.x, y: ME.y, zoom: 0.62, tilt: 42, turn: -24 + frame * 0.1 }} width={W} height={H} show={{ ...BARE, mates: false }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ opacity: 1 - leave, transform: `translateY(${-leave * 40}px)` }}>
        {/* Selection band behind the reel's centre row. */}
        <div
          style={{
            position: "absolute",
            left: cx - bandW / 2 - 20,
            width: bandW + 40,
            top: cy - rowH / 2 - 4,
            height: rowH + 8,
            borderRadius: 14,
            background: rgba(C.panel, 0.72),
            border: `2px solid ${landed ? mixHex(C.line2, C.amber, Math.max(landFlash, 0.55)) : C.line2}`,
            boxShadow: landed ? `0 0 ${40 * landFlash + 12}px ${rgba(C.amber, 0.25 + 0.4 * landFlash)}` : "0 10px 40px rgba(0, 0, 0, 0.5)",
          }}
        />
        <div style={{ position: "absolute", left: cx - bandW / 2 - 20, top: cy - rowH / 2 - 4, width: 8, height: rowH + 8, borderRadius: "14px 0 0 14px", background: C.amber }} />
        <div
          style={{
            position: "absolute",
            inset: 0,
            WebkitMaskImage: `linear-gradient(to bottom, transparent ${((cy - rowH * 3.6) / H) * 100}%, #000 ${((cy - rowH * 1.4) / H) * 100}%, #000 ${((cy + rowH * 1.4) / H) * 100}%, transparent ${((cy + rowH * 3.6) / H) * 100}%)`,
            maskImage: `linear-gradient(to bottom, transparent ${((cy - rowH * 3.6) / H) * 100}%, #000 ${((cy - rowH * 1.4) / H) * 100}%, #000 ${((cy + rowH * 1.4) / H) * 100}%, transparent ${((cy + rowH * 3.6) / H) * 100}%)`,
          }}
        >
          {rows}
        </div>
        {landed ? (
          <div
            style={{
              position: "absolute",
              left: cx - bandW / 2,
              width: bandW,
              top: cy + rowH / 2 + 26,
              textAlign: "center",
              font: `500 ${portrait ? 24 : 20}px ${MONO}`,
              letterSpacing: "0.16em",
              color: C.fg2,
            }}
          >
            {sub}
          </div>
        ) : null}
      </AbsoluteFill>
      <EdgeScrim side={portrait ? "bottom" : "left"} size={portrait ? 700 : 900} />
      <Headline
        lines={[{ text: "13 MAPS.", accent: "13" }, { text: "AUTO-DETECTED." }]}
        at={[...MAPS.headline]}
        out={MAPS.out}
        x={portrait ? 80 : 130}
        y={portrait ? H - 330 : H / 2 + 120}
        size={hlSize}
      />
    </AbsoluteFill>
  );
};

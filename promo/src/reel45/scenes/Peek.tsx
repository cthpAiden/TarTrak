import { AbsoluteFill, spring, useCurrentFrame } from "remotion";
import { MONO, SANS } from "../../fonts.ts";
import { C, SPRING_POP } from "../../theme.ts";
import { clamp, easeInOutCubic, easeOutCubic, lerp, prog } from "../../lib/ease.ts";
import { rng } from "../../lib/random.ts";
import { Headline } from "../../components/Headline.tsx";
import { Keycap } from "../../components/Keycap.tsx";
import { Ping } from "../../components/Ping.tsx";
import { project, type Cam } from "../../world/camera.ts";
import { MATES, ME, fromBearing, type Pt } from "../../world/data.ts";
import { PEEK } from "../timeline.ts";
import { At, BARE, SettledWorld, rgba, useLayout } from "../kit.tsx";

const GHOST = MATES.find((m) => m.id === "ghost")!;
/** The enemy I can see: 55 m out along my heading, past the trees. */
const ENEMY: Pt = fromBearing(ME, ME.heading, 55);
const HEADER = 44;

/** A patch of forest round me and between me and him, drawn as canopy blobs on GHOST's map. */
const CANOPY = (() => {
  const r = rng(4242);
  return Array.from({ length: 26 }, () => {
    const along = r() * 1.1 - 0.15;
    const side = (r() - 0.5) * 150;
    const a = ((ME.heading - 90) * Math.PI) / 180;
    const base = { x: ME.x + (ENEMY.x - ME.x) * along, y: ME.y + (ENEMY.y - ME.y) * along };
    return { x: base.x - Math.sin(a) * side * 0.5 + (r() - 0.5) * 40, y: base.y + Math.cos(a) * side * 0.5 + (r() - 0.5) * 40, rad: 18 + r() * 22, shade: r() };
  });
})();

function panel(W: number, H: number, portrait: boolean) {
  return portrait ? { x: 60, y: 150, w: W - 120, h: 1180 } : { x: 160, y: 96, w: W - 320, h: 690 };
}
function cam(frame: number, portrait: boolean): Cam {
  const mid = { x: lerp(GHOST.x, ENEMY.x, 0.45), y: lerp(GHOST.y, ENEMY.y, 0.45) };
  return { x: mid.x + frame * 0.04, y: mid.y, zoom: portrait ? 2.1 : 2.3, tilt: 0, turn: 0 };
}

/**
 * My screenshot: dusk woods from where I stand. Trunks frame it; past them, a player stands in a gap.
 * Drawn in a 1600 x 900 box, scaled to fill whatever holds it.
 */
const WOODS = (() => {
  const r = rng(777);
  const far = Array.from({ length: 60 }, (_, i) => ({ x: i * 28 + r() * 20, h: 60 + r() * 90, w: 26 + r() * 22 }));
  const trunks = [
    { x: 90, w: 120 },
    { x: 330, w: 54 },
    { x: 560, w: 34 },
    { x: 760, w: 26 },
    { x: 1180, w: 40 },
    { x: 1330, w: 70 },
    { x: 1500, w: 140 },
  ];
  return { far, trunks };
})();
const ENEMY_IN_SHOT = { x: 960, y: 560 };
const Woods = ({ ring }: { ring: number }) => (
  <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
    <defs>
      <linearGradient id="peek-sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#2a3442" />
        <stop offset="0.55" stopColor="#4a5560" />
        <stop offset="1" stopColor="#1b2118" />
      </linearGradient>
      <linearGradient id="peek-ground" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#2b3324" />
        <stop offset="1" stopColor="#141910" />
      </linearGradient>
    </defs>
    <rect width="1600" height="900" fill="url(#peek-sky)" />
    {WOODS.far.map((t, i) => (
      <path key={i} d={`M${t.x - t.w / 2} 600 L${t.x} ${600 - t.h * 2.2} L${t.x + t.w / 2} 600 Z`} fill={i % 3 ? "#1c2419" : "#222b1e"} />
    ))}
    <rect y="590" width="1600" height="310" fill="url(#peek-ground)" />
    {/* The player in the gap: a dark figure with a rifle, half behind the near trunk's shadow. */}
    <g transform={`translate(${ENEMY_IN_SHOT.x} ${ENEMY_IN_SHOT.y + 40}) scale(1.8)`} fill="#0b0e0a">
      <circle cx="0" cy="-58" r="9" />
      <path d="M-11 -48 h22 l4 36 h-8 l-1 40 h-8 l-1 -28 l-2 28 h-8 l1 -40 h-8 z" />
      <path d="M8 -38 l30 -6 l1 4 l-30 7 z" />
    </g>
    {WOODS.trunks.map((t, i) => (
      <rect key={i} x={t.x - t.w / 2} y={-20} width={t.w} height={960} fill={i === 0 || i === WOODS.trunks.length - 1 ? "#0a0d09" : "#121810"} />
    ))}
    <rect width="1600" height="900" fill="url(#peek-sky)" opacity="0.08" />
    {ring > 0 ? (
      <g transform={`translate(${ENEMY_IN_SHOT.x} ${ENEMY_IN_SHOT.y - 10})`} opacity={clamp(ring * 2)}>
        <circle r={lerp(220, 110, easeOutCubic(ring))} fill="none" stroke={C.north} strokeWidth={6} />
        <circle r={lerp(220, 110, easeOutCubic(ring))} fill="none" stroke={C.north} strokeWidth={22} opacity={0.18} />
      </g>
    ) : null}
  </svg>
);

/** The app's screenshot popup: a 28 px bar ("YOU shared a screenshot", close) over the picture. */
const Popup = ({ x, y, w, h, ring, alpha }: { x: number; y: number; w: number; h: number; ring: number; alpha: number }) => {
  const bar = 40;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: h,
        display: "flex",
        flexDirection: "column",
        background: "rgba(22, 26, 32, 0.96)",
        border: `1px solid ${C.line2}`,
        borderRadius: 6,
        overflow: "hidden",
        boxShadow: "0 24px 70px rgba(0, 0, 0, 0.65)",
        opacity: alpha,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, height: bar, flex: "none", padding: "0 12px", font: `500 18px ${SANS}`, whiteSpace: "nowrap" }}>
        <span style={{ width: 11, height: 11, borderRadius: "50%", background: C.amber }} />
        <span style={{ fontWeight: 600, color: C.amber }}>YOU</span>
        <span style={{ color: C.muted, flex: 1 }}>shared a screenshot</span>
        <span style={{ color: C.fg2, fontSize: 24, lineHeight: 1 }}>×</span>
      </div>
      <div style={{ position: "relative", flex: 1, background: "#000" }}>
        <Woods ring={ring} />
      </div>
    </div>
  );
};

/** A voice chip: who is talking and what they said. */
const Voice = ({ x, y, size, frame }: { x: number; y: number; size: number; frame: number }) => {
  if (frame < PEEK.ask) return null;
  const s = spring({ frame: frame - PEEK.ask, fps: 60, config: SPRING_POP });
  const off = prog(frame, PEEK.f8[0] - 10, PEEK.f8[0]);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 20px",
        borderRadius: 14,
        background: "rgba(15, 19, 24, 0.94)",
        border: `1px solid ${rgba(C.ghost, 0.7)}`,
        boxShadow: "0 12px 40px rgba(0, 0, 0, 0.5)",
        font: `500 ${size}px ${SANS}`,
        color: C.fg,
        transformOrigin: "0 50%",
        transform: `scale(${s * (1 - off * 0.1)})`,
        opacity: clamp(s * 2) * (1 - off),
      }}
    >
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={C.ghost} strokeWidth={1.6} strokeLinecap="round">
        <rect x="5.5" y="1.5" width="5" height="8" rx="2.5" />
        <path d="M3 7.5a5 5 0 0 0 10 0M8 12.5v2" />
      </svg>
      <span style={{ font: `700 ${size}px ${MONO}`, color: C.ghost, letterSpacing: "0.06em" }}>GHOST</span>
      "where are you?"
    </div>
  );
};

/**
 * Scene 11, SEE WHAT I SEE (local 0-359): the F8 story. GHOST's screen: he asks where I am. I take a
 * screenshot and land on his map, deep in trees. I press F8; my screenshot pops up at the bottom-left of
 * his screen, enlarges, and a red ring finds the player I am looking at. It shrinks away, the enemy is
 * marked on his map and GHOST's push draws towards him.
 */
export const Peek = () => {
  const frame = useCurrentFrame();
  const { W, H, portrait } = useLayout();
  const b = panel(W, H, portrait);
  const mapH = b.h - HEADER;
  const c = cam(frame, portrait);
  const P = (p: Pt) => {
    const q = project(c, p, b.w, mapH);
    return { x: b.x + q.x, y: b.y + HEADER + q.y };
  };
  const unit = c.zoom;
  const enter = spring({ frame, fps: 60, config: SPRING_POP });
  const leave = prog(frame, PEEK.out, PEEK.out + 14, easeOutCubic);
  const me = P(ME), ghost = P(GHOST), enemy = P(ENEMY);
  const look = P(fromBearing(ME, ME.heading, 100));
  const landed = frame >= PEEK.land;
  const meS = landed ? spring({ frame: frame - PEEK.land, fps: 60, config: SPRING_POP }) : 0;
  // The popup: small at the bottom-left, then big over the map, then gone.
  const small = portrait ? { w: 560, h: 355 } : { w: 512, h: 328 };
  const smallAt = { x: b.x + 24, y: b.y + b.h - small.h - 24 };
  const bigW = portrait ? b.w - 40 : 1120;
  const big = { w: bigW, h: Math.round(bigW * (9 / 16)) + 40 };
  const bigAt = { x: b.x + (b.w - big.w) / 2, y: b.y + HEADER + (mapH - big.h) / 2 };
  const grow = easeInOutCubic(prog(frame, PEEK.big[0], PEEK.big[1]));
  const away = easeInOutCubic(prog(frame, PEEK.small[0], PEEK.small[1]));
  const popIn = frame >= PEEK.popup ? spring({ frame: frame - PEEK.popup, fps: 60, config: SPRING_POP }) : 0;
  const pw = lerp(small.w, big.w, grow) * lerp(0.6, 1, popIn);
  const ph = lerp(small.h, big.h, grow) * lerp(0.6, 1, popIn);
  const px = lerp(smallAt.x, bigAt.x, grow) + lerp(-60, 0, popIn) - away * 120;
  const py = lerp(smallAt.y + small.h, bigAt.y + big.h, grow) - ph + away * 160;
  const ring = prog(frame, PEEK.ring, PEEK.ring + 18);
  const push = easeInOutCubic(prog(frame, PEEK.push[0], PEEK.push[1]));
  // GHOST flanks: out to the side, then in on the enemy.
  const flank = fromBearing(ENEMY, ME.heading - 120, 30);
  const pushPts = Array.from({ length: 40 }, (_, i) => {
    const t = (i / 39) * push;
    const u = 1 - t;
    return P({ x: u * u * GHOST.x + 2 * u * t * flank.x + t * t * ENEMY.x, y: u * u * GHOST.y + 2 * u * t * flank.y + t * t * ENEMY.y });
  });
  const key = portrait ? { x: b.x + b.w - 120, y: b.y + HEADER + 110, s: 150 } : { x: b.x + b.w - 120, y: b.y + HEADER + 110, s: 140 };
  const keyFade = (release: number) => 1 - prog(frame, release + 14, release + 24);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ opacity: 1 - leave }}>
        <div
          style={{
            position: "absolute",
            left: b.x,
            top: b.y,
            width: b.w,
            height: b.h,
            borderRadius: 14,
            overflow: "hidden",
            background: C.panel,
            border: `2px solid ${C.line2}`,
            boxShadow: "0 20px 60px rgba(0, 0, 0, 0.55)",
            opacity: clamp(enter * 1.5),
            transform: `translateY(${(1 - enter) * 60}px)`,
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
            <span style={{ width: 12, height: 12, borderRadius: "50%", background: C.ghost, boxShadow: `0 0 10px ${C.ghost}` }} />
            GHOST'S SCREEN
            <span style={{ marginLeft: "auto", color: C.muted, fontSize: 13 }}>ROOM K7Q2XM</span>
          </div>
          <div style={{ position: "relative", width: b.w, height: mapH }}>
            <SettledWorld cam={c} width={b.w} height={mapH} show={{ ...BARE, mates: false }} extrude={0} />
          </div>
        </div>
        <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0, opacity: clamp(enter * 1.5) }}>
          <defs>
            <clipPath id="peek-map">
              <rect x={b.x} y={b.y + HEADER} width={b.w} height={mapH} />
            </clipPath>
          </defs>
          <g clipPath="url(#peek-map)">
            {CANOPY.map((t, i) => {
              const p = P(t);
              return <circle key={i} cx={p.x} cy={p.y} r={t.rad * unit} fill={t.shade > 0.5 ? "#2c3b25" : "#33452b"} stroke="#1d2818" strokeWidth={2} opacity={0.92} />;
            })}
            {/* GHOST's push. */}
            {push > 0 ? (
              <>
                <polyline points={pushPts.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke={rgba(C.ghost, 0.35)} strokeWidth={14} strokeLinecap="round" style={{ filter: "blur(5px)" }} />
                <polyline
                  points={pushPts.map((p) => `${p.x},${p.y}`).join(" ")}
                  fill="none"
                  stroke={C.ghost}
                  strokeWidth={5}
                  strokeDasharray="16 10"
                  strokeDashoffset={-frame * 1.4}
                  strokeLinecap="round"
                />
              </>
            ) : null}
            {/* My heading, as the screenshot left it. */}
            {landed ? (
              <line
                x1={me.x}
                y1={me.y}
                x2={lerp(me.x, look.x, meS)}
                y2={lerp(me.y, look.y, meS)}
                stroke={rgba(C.amber, 0.85)}
                strokeWidth={4}
                strokeDasharray="2 9"
                strokeLinecap="round"
              />
            ) : null}
          </g>
        </svg>
        {/* GHOST himself. */}
        <At x={ghost.x} y={ghost.y} style={{ opacity: clamp(enter * 1.5) }}>
          <div style={{ position: "absolute", left: -11, top: -11, width: 22, height: 22, borderRadius: "50%", background: C.ghost, border: `3px solid ${C.deep}`, boxShadow: `0 0 14px ${C.ghost}` }} />
          <div style={{ position: "absolute", left: 18, top: -14, font: `600 ${portrait ? 18 : 16}px ${MONO}`, letterSpacing: "0.08em", color: C.ghost, whiteSpace: "nowrap" }}>GHOST</div>
        </At>
        {landed ? (
          <>
            <Ping at={PEEK.land} cx={me.x} cy={me.y} maxR={120} dur={36} width={3} />
            <At x={me.x} y={me.y} style={{ transform: `scale(${meS})` }}>
              <div style={{ position: "absolute", left: -12, top: -12, width: 24, height: 24, borderRadius: "50%", background: C.amber, border: `3px solid ${C.deep}`, boxShadow: `0 0 16px ${C.amber}` }} />
              <div
                style={{
                  position: "absolute",
                  left: 20,
                  top: -16,
                  padding: "2px 10px",
                  borderRadius: 6,
                  background: "rgba(0, 0, 0, 0.45)",
                  font: `600 ${portrait ? 20 : 17}px ${SANS}`,
                  color: "#fff",
                  whiteSpace: "nowrap",
                }}
              >
                YOU
              </div>
            </At>
          </>
        ) : null}
        {frame >= PEEK.mark ? (
          <>
            <Ping at={PEEK.mark} cx={enemy.x} cy={enemy.y} maxR={110} color={C.north} dur={34} width={3} />
            <At x={enemy.x} y={enemy.y} style={{ transform: `scale(${spring({ frame: frame - PEEK.mark, fps: 60, config: SPRING_POP })})` }}>
              <svg width={44} height={44} viewBox="-22 -22 44 44" style={{ position: "absolute", left: -22, top: -22, overflow: "visible" }}>
                <circle r={17} fill={rgba(C.north, 0.18)} stroke={C.north} strokeWidth={3} />
                <path d="M-8 -8 L8 8 M8 -8 L-8 8" stroke={C.north} strokeWidth={4} strokeLinecap="round" />
              </svg>
              <div
                style={{
                  position: "absolute",
                  left: 26,
                  top: -14,
                  padding: "2px 10px",
                  borderRadius: 6,
                  background: "rgba(15, 19, 24, 0.9)",
                  border: `1px solid ${rgba(C.north, 0.7)}`,
                  font: `600 ${portrait ? 18 : 15}px ${MONO}`,
                  letterSpacing: "0.08em",
                  color: C.north,
                  whiteSpace: "nowrap",
                }}
              >
                ENEMY
              </div>
            </At>
          </>
        ) : null}
        <Voice x={b.x + 24} y={b.y + HEADER + 22} size={portrait ? 30 : 26} frame={frame} />
        {frame >= PEEK.popup && frame < PEEK.small[1] ? <Popup x={px} y={py} w={pw} h={ph} ring={ring} alpha={clamp(popIn * 2) * (1 - away)} /> : null}
        <div style={{ opacity: keyFade(PEEK.key[2]) }}>
          <Keycap label="PRT SC" sub="SCREENSHOT" x={key.x} y={key.y} size={key.s} appearAt={PEEK.key[0]} pressAt={PEEK.key[1]} releaseAt={PEEK.key[2]} />
        </div>
        <div style={{ opacity: keyFade(PEEK.f8[2]) }}>
          <Keycap label="F8" sub="SHARE" x={key.x} y={key.y} size={key.s} appearAt={PEEK.f8[0]} pressAt={PEEK.f8[1]} releaseAt={PEEK.f8[2]} />
        </div>
      </AbsoluteFill>
      <Headline
        lines={[{ text: "PRESS F8." }, { text: "SEE WHAT I SEE.", accent: "SEE" }]}
        at={[...PEEK.headline]}
        out={PEEK.out}
        x={W / 2}
        y={portrait ? H - 170 : H - 70}
        size={portrait ? 110 : 104}
        align="center"
      />
    </AbsoluteFill>
  );
};

import { AbsoluteFill, spring, useCurrentFrame } from "remotion";
import { LogoMark } from "../components/Logo.tsx";
import { C, SPRING_POP } from "../theme.ts";
import { clamp, easeOutCubic, easeOutExpo, lerp, prog } from "../lib/ease.ts";
import { HANDOFF } from "../timeline.ts";
import { Burst, HIT, HitFlash, K, Shockwave, TopMark, fullFrame, heatAt, mixHex, type Ring } from "./end/Hit.tsx";
import { Badges, Tagline, Url, Wordmark } from "./end/Type.tsx";

/** The logo at rest: ring outer radius 92 round (960, 336); the rows under it are in end/Type.tsx. */
const LOGO = { cx: 960, cy: 336, r: 92 } as const;
/** LogoMark's own ring width at that size (0.106 of the outer diameter), so the morph lands on it exactly. */
const LOGO_SW = 0.106 * 2 * LOGO.r;
/** The bezel's band at the cut: the app's RING (26 px) scaled like the rest of shot 6's bezel. */
const BAND = 26 * K;

/**
 * The bezel ring collapsing into the logo (easeOutExpo, 720-752): outer radius 270 -> 92, centre
 * (960, 540) -> (960, 336), band 37 px -> the logo's natural stroke, so nothing jumps at either end.
 */
function ringAt(frame: number): Ring {
  const m = prog(frame, HIT, 752, easeOutExpo);
  return { cx: LOGO.cx, cy: lerp(HANDOFF.logo.cy, LOGO.cy, m), r: lerp(HANDOFF.logo.r, LOGO.r, m), sw: lerp(BAND, LOGO_SW, m) };
}

const amber = (a: number) => `rgba(240, 180, 41, ${a})`;

/**
 * Amber bloom behind the logo, 18% at its peak, strongest on the ring and falling off both ways (the
 * ring's hole stays dark, as in the app icon). It grows in as the ring lands and then breathes slowly
 * (3 s period).
 */
const Bloom = ({ ring }: { ring: Ring }) => {
  const frame = useCurrentFrame();
  const k = prog(frame, 724, 760, easeOutCubic);
  if (k <= 0) return null;
  const breathe = frame > 752 ? Math.sin(((frame - 752) / 180) * 2 * Math.PI) : 0;
  const R = ring.r * 3.3 * (1 + 0.03 * breathe);
  const a = 0.18 * k * (1 + 0.12 * breathe);
  const at = (ring.r / R) * 100;
  return (
    <div
      style={{
        position: "absolute",
        left: ring.cx - R,
        top: ring.cy - R,
        width: 2 * R,
        height: 2 * R,
        background: `radial-gradient(circle closest-side, ${amber(a * 0.25)} 0%, ${amber(a * 0.55)} ${at * 0.7}%, ${amber(a)} ${at}%, ${amber(a * 0.62)} ${at * 1.45}%, ${amber(a * 0.28)} ${at * 2}%, ${amber(a * 0.08)} ${at * 2.6}%, ${amber(0)} 100%)`,
      }}
    />
  );
};

/** The mark itself: white-hot on the hit, amber from 723; the tick springs out of the ring from 728; a glow flare as it pings at 840. */
const Logo = ({ ring }: { ring: Ring }) => {
  const frame = useCurrentFrame();
  const heat = heatAt(frame);
  const tick = frame < 728 ? 0 : frame >= 788 ? 1 : spring({ frame: frame - 728, fps: 60, config: SPRING_POP });
  const flare = frame >= 840 ? Math.max(0, 1 - (frame - 840) / 24) : 0;
  // While the ring is big the hit's halo is its glow; LogoMark's own bloom (a blur that grows with the
  // size, slow to render at 540 px) comes in as it shrinks.
  const own = clamp((150 - ring.r) / 40);
  return (
    <div style={{ position: "absolute", left: ring.cx - ring.r, top: ring.cy - ring.r }}>
      <LogoMark
        size={2 * ring.r}
        strokeWidth={ring.sw}
        stroke={heat > 0 ? mixHex(C.amber, "#ffffff", heat) : C.amber}
        tick={tick}
        glow={Math.min(1, 0.7 * own + 0.3 * flare)}
      />
    </div>
  );
};

/** One slow sonar ping off the logo's rim at 840, r 92 -> 520, fading out by 896 so the poster holds clean. */
const LastPing = () => {
  const frame = useCurrentFrame();
  const t = (frame - 840) / 56;
  if (t < 0 || t >= 1) return null;
  const r = LOGO.r + (520 - LOGO.r) * easeOutCubic(t);
  const o = (1 - t) * (1 - 0.35 * t);
  return (
    <svg width={1920} height={1080} style={fullFrame}>
      <circle cx={LOGO.cx} cy={LOGO.cy} r={r} fill="none" stroke={C.amber} strokeWidth={14} opacity={o * 0.05} />
      <circle cx={LOGO.cx} cy={LOGO.cy} r={r} fill="none" stroke={C.amber} strokeWidth={6} opacity={o * 0.14} />
      <circle cx={LOGO.cx} cy={LOGO.cy} r={r} fill="none" stroke={C.amber} strokeWidth={2} opacity={o} />
    </svg>
  );
};

/**
 * Shot 7, END CARD (720-899). On the final hit the bezel ring from shot 6 (outer r 270 round the frame's
 * centre, heading box at 12 o'clock) flashes white, sheds its 84 ticks as streaks and a shockwave, and
 * collapses into the TarTrak logo; the wordmark, tagline, badges and repo URL land on the score's cues,
 * one last ping, and the card holds as the poster (899).
 */
export const Shot7End = () => {
  const frame = useCurrentFrame();
  if (frame < HIT) return null;
  const ring = ringAt(frame);
  return (
    <AbsoluteFill>
      <Bloom ring={ring} />
      <LastPing />
      <Shockwave />
      <Burst />
      <HitFlash ring={ring} />
      <Logo ring={ring} />
      <TopMark ring={ring} />
      <Wordmark />
      <Tagline />
      <Badges />
      <Url />
    </AbsoluteFill>
  );
};

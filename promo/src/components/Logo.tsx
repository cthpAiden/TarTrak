import { Img, staticFile } from "remotion";
import { C } from "../theme.ts";
import { clamp } from "../lib/ease.ts";

/*
 * The app icon (design/icon-concepts/variations/H1b-topo-amber.svg, copied to public/logo.svg) is
 * 512 units square; its compass dial's outer edge has radius 200.5, centred.
 */
const DIAL_R = 200.5;

/**
 * The TarTrak mark: the app icon (topo compass). The element is `size` px square with the dial's outer
 * edge touching its sides (so its centre is the dial's centre); the icon's tile overhangs that box by
 * about 0.08 x size on each side. `ring` 0..1 fades and scales the icon in; `glow` 0..1 is an amber bloom.
 */
export const LogoMark = ({ size, ring = 1, glow = 1 }: { size: number; ring?: number; glow?: number }) => {
  const full = (size * 256) / DIAL_R;
  const k = clamp(ring);
  const g = clamp(glow);
  const bloom = (blur: number, pct: number) => `drop-shadow(0 0 ${blur}px color-mix(in srgb, ${C.amber} ${pct}%, transparent))`;
  if (k <= 0) return <div style={{ width: size, height: size }} />;
  return (
    <div style={{ position: "relative", width: size, height: size, overflow: "visible" }} aria-hidden>
      <Img
        src={staticFile("logo.svg")}
        style={{
          position: "absolute",
          left: (size - full) / 2,
          top: (size - full) / 2,
          width: full,
          height: full,
          opacity: k,
          transform: `scale(${0.85 + 0.15 * k})`,
          filter: g > 0 ? `${bloom(size * 0.03, Math.round(35 * g))} ${bloom(size * 0.12, Math.round(18 * g))}` : undefined,
        }}
      />
    </div>
  );
};

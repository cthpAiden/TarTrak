import { useLayoutEffect, useRef } from "react";
import { useCurrentFrame } from "remotion";

const W = 960;
const H = 540;

/** Inverse normal CDF (Abramowitz-Stegun 26.2.23, error under 5e-4). */
const probit = (p: number): number => {
  const q = p < 0.5 ? p : 1 - p;
  const t = Math.sqrt(-2 * Math.log(q));
  const x = t - (2.515517 + 0.802853 * t + 0.010328 * t * t) / (1 + 1.432788 * t + 0.189269 * t * t + 0.001308 * t * t * t);
  return p < 0.5 ? -x : x;
};

/** 256 Gaussian grey levels round mid-grey (sd `sd`, 0..1), packed as little-endian RGBA words. */
const levels = (sd: number): Uint32Array => {
  const out = new Uint32Array(256);
  for (let k = 0; k < 256; k++) {
    const v = Math.max(0, Math.min(255, Math.round(127.5 + probit((k + 0.5) / 256) * sd * 255)));
    out[k] = (0xff000000 | (v << 16) | (v << 8) | v) >>> 0;
  }
  return out;
};

/** Noise sd per unit of `opacity`, tuned by eye: at 0.06 the grain measures an sd of about 2 levels on the map ground, 1 on the backdrop. */
const SD_PER_OPACITY = 0.7;

/**
 * Film grain: a 960x540 canvas of seeded Gaussian noise (seed = frame), scaled to the frame and laid
 * over it in `overlay`. `opacity` is the grain strength (the layer itself is opaque): the noise's
 * standard deviation round mid-grey is `opacity * 0.7` of full scale. Overlay scales it by each pixel's
 * distance from black or white, so it shows most in the mid-tones and stays a faint texture on the
 * near-black backdrop, like film. A plain 6% layer opacity would vanish on this dark palette.
 */
export const Grain = ({ opacity }: { opacity: number }) => {
  const frame = useCurrentFrame();
  const ref = useRef<HTMLCanvasElement>(null);
  const buffer = useRef<ImageData | null>(null);
  useLayoutEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    buffer.current ??= ctx.createImageData(W, H);
    const img = buffer.current;
    const px = new Uint32Array(img.data.buffer);
    const lut = levels(opacity * SD_PER_OPACITY);
    // xorshift32, re-seeded every frame; the top byte of a multiplied state picks the level.
    let s = Math.imul(frame + 1, 0x9e3779b1) ^ 0x2545f491 || 1;
    for (let i = 0; i < px.length; i++) {
      s ^= s << 13;
      s ^= s >>> 17;
      s ^= s << 5;
      px[i] = lut[Math.imul(s, 0x2c1b3c6d) >>> 24];
    }
    ctx.putImageData(img, 0, 0);
  }, [frame, opacity]);
  return (
    <canvas
      ref={ref}
      width={W}
      height={H}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", mixBlendMode: "overlay", pointerEvents: "none" }}
    />
  );
};

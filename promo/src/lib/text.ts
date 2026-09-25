import { clamp } from "./ease.ts";
import { hash01 } from "./random.ts";

const GLYPHS = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%&*+-/<>=";

/**
 * Decodes `target` left to right: the first `progress * length` characters are final, the rest cycle
 * through random glyphs that change every `every` frames. Spaces never scramble.
 */
export function scramble(target: string, progress: number, frame: number, seed = 1, every = 2): string {
  const done = Math.floor(clamp(progress) * target.length);
  let out = "";
  for (let i = 0; i < target.length; i++) {
    const ch = target[i];
    if (i < done || ch === " ") out += ch;
    else out += GLYPHS[Math.floor(hash01(seed + Math.floor(frame / every), i) * GLYPHS.length)];
  }
  return out;
}

/** The first `progress` share of `target`, for typing effects. */
export function typed(target: string, progress: number): string {
  return target.slice(0, Math.round(clamp(progress) * target.length));
}

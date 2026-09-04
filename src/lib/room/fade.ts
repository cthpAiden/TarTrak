export const FADE_START_MS = 30_000;
export const FADE_END_MS = 300_000;
export const FADE_FLOOR = 0.35;

/** 1.0 for the first 30 s, then linear down to 0.35 at 5 min, never lower. */
export function opacityFor(ageMs: number): number {
  if (ageMs <= FADE_START_MS) return 1;
  if (ageMs >= FADE_END_MS) return FADE_FLOOR;
  const t = (ageMs - FADE_START_MS) / (FADE_END_MS - FADE_START_MS);
  return 1 - t * (1 - FADE_FLOOR);
}

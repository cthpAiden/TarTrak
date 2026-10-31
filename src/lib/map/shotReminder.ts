/** Opt-in screenshot reminder: the map turns grey when I have gone too long without a screenshot. */

/** Seconds without a screenshot before the grey starts. */
export const SHOT_REMINDER_DELAY_S = 30;
/** How long the map takes to go from full colour to fully grey. */
export const SHOT_FADE_MS = 20_000;

/** 0 is full colour, 1 fully grey: 0 until `delayS` has passed since the last screenshot, then linear over SHOT_FADE_MS. */
export function shotFade(sinceMs: number, delayS: number): number {
  const t = (sinceMs - delayS * 1000) / SHOT_FADE_MS;
  return Math.max(0, Math.min(1, t));
}

/**
 * How grey the map is now. Only in a raid whose end is still ahead; the count runs from my last screenshot,
 * or from when the raid was first seen if I have not taken one since.
 */
export function mapGrey(now: number, raidEndsAt: number | null, lastShotAt: number, raidSeenAt: number, delayS: number): number {
  if (raidEndsAt === null || now >= raidEndsAt) return 0;
  return shotFade(now - Math.max(lastShotAt, raidSeenAt), delayS);
}

/** Opt-in screenshot reminder: a red tag next to my marker says how old my position is once I forget. */

/** Seconds without a screenshot before the tag shows. */
export const SHOT_REMINDER_DELAY_S = 30;

/**
 * Whole seconds since my last screenshot once that is at least `delayS`, else null (no tag). Only in a raid whose
 * end is still ahead; the count runs from my last screenshot, or from when the raid was first seen if I have not
 * taken one since.
 */
export function shotAgeS(now: number, raidEndsAt: number | null, lastShotAt: number, raidSeenAt: number, delayS: number): number | null {
  if (raidEndsAt === null || now >= raidEndsAt) return null;
  const s = Math.floor((now - Math.max(lastShotAt, raidSeenAt)) / 1000);
  return s >= delayS ? s : null;
}

/** "45s" under a minute, then "1:06". */
export function shotAgeText(s: number): string {
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

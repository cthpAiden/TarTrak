/** Opt-in screenshot reminder: the map's border pulses when I have gone too long without a screenshot. */

/** Seconds without a screenshot before the border starts pulsing. */
export const SHOT_REMINDER_DELAY_S = 30;

/**
 * Whether the reminder is on now. Only in a raid whose end is still ahead; the count runs from my last screenshot,
 * or from when the raid was first seen if I have not taken one since.
 */
export function shotOverdue(now: number, raidEndsAt: number | null, lastShotAt: number, raidSeenAt: number, delayS: number): boolean {
  if (raidEndsAt === null || now >= raidEndsAt) return false;
  return now - Math.max(lastShotAt, raidSeenAt) >= delayS * 1000;
}

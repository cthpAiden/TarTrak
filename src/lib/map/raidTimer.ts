/** How long 00:00 stays up after the raid ends before the pill hides. */
const LINGER_MS = 60_000;
/** A wall-clock step at least this big is the PC's clock being set, not a late timer. */
const CLOCK_JUMP_MS = 1000;
/** How far past a second's edge the next tick lands, so the rounded-down second has moved by then. */
const TICK_SLACK_MS = 5;

/**
 * Ms until the shown second changes. Ticking on the raid end's own second edges keeps the pill in step with
 * the in-game watch; a plain 1 s interval from wherever it started could run up to a second behind it.
 */
export function msToNextSecond(endsAt: number, now: number): number {
  return ((((endsAt - now) % 1000) + 1000) % 1000) + TICK_SLACK_MS;
}

/**
 * How far the PC's clock was set between two readings: how much more the wall clock moved than the
 * monotonic one. 0 under CLOCK_JUMP_MS. The raid's end is on the wall clock, so it has to move by this too.
 */
export function clockJump(wallBefore: number, monoBefore: number, wall: number, mono: number): number {
  const jump = wall - wallBefore - (mono - monoBefore);
  return Math.abs(jump) < CLOCK_JUMP_MS ? 0 : jump;
}

/**
 * Time left in the raid as mm:ss, from the epoch ms the game says it ends. Whole seconds, rounded down
 * like the in-game watch. 00:00 for a minute after the end; null after that or without an end.
 */
export function raidTimeLeft(endsAt: number | null, now: number): string | null {
  if (endsAt === null) return null;
  const left = endsAt - now;
  if (left <= -LINGER_MS) return null;
  const s = Math.max(0, Math.floor(left / 1000));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

/** Time left, in seconds, from which the raid timer shows red. */
const LOW_S = 600;

/** Whether the raid timer reads 10:00 or less, counted the same way raidTimeLeft rounds. */
export function raidTimeLow(endsAt: number | null, now: number): boolean {
  return endsAt !== null && Math.floor((endsAt - now) / 1000) <= LOW_S;
}

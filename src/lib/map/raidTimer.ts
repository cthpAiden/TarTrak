/** How long 00:00 stays up after the raid ends before the pill hides. */
const LINGER_MS = 60_000;

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

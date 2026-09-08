/** How long 00:00 stays up after the raid ends before the pill hides. */
const LINGER_MS = 60_000;

/**
 * Time left in the raid as mm:ss, from the log's GameStarted moment and the map's raid length in
 * minutes. Whole seconds, rounded down like the in-game watch. 00:00 for a minute after the end;
 * null after that, without a start or a length, or for a start still in the future.
 */
export function raidTimeLeft(startedAt: number | null, durationMin: number | undefined, now: number): string | null {
  if (startedAt === null || !durationMin || durationMin <= 0) return null;
  const elapsed = now - startedAt;
  if (elapsed < 0) return null;
  const left = durationMin * 60_000 - elapsed;
  if (left <= -LINGER_MS) return null;
  const s = Math.max(0, Math.floor(left / 1000));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

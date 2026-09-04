/**
 * Runs `attempt` every `ms` until it resolves true, then stops. Overlapping ticks are skipped,
 * so a slow attempt cannot pile up. Returns a canceller that is safe to call more than once.
 */
export function retryUntil(attempt: () => Promise<boolean>, ms: number): () => void {
  let timer: ReturnType<typeof setInterval> | null = null;
  let running = false;
  const stop = () => {
    if (timer !== null) clearInterval(timer);
    timer = null;
  };
  timer = setInterval(() => {
    if (running) return;
    running = true;
    attempt()
      .then((done) => {
        if (done) stop();
      })
      .catch(() => {})
      .finally(() => {
        running = false;
      });
  }, ms);
  return stop;
}

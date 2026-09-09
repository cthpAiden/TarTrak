import type { Position } from "../parse/screenshot";

/** The game writes the screenshot this long after the chord at most. */
export const MARK_WINDOW_MS = 2000;

/**
 * Pairs a mark chord (screenshot key pressed while the mark key is held, detected in Rust) with the
 * screenshot file the game writes right after it. A chord marks the next screenshot within the
 * window, once; a screenshot with no chord before it is only a position update.
 */
export class MarkPairer {
  private pressAt = -Infinity;

  constructor(
    private readonly onMark: (p: Position) => void,
    private readonly windowMs = MARK_WINDOW_MS,
  ) {}

  press(now: number = Date.now()): void {
    this.pressAt = now;
  }

  screenshot(p: Position, now: number = Date.now()): void {
    if (now - this.pressAt > this.windowMs) return;
    this.pressAt = -Infinity;
    this.onMark(p);
  }
}

import type { Position } from "../parse/screenshot";

/** A press and a screenshot this far apart, either order, belong together. */
export const MARK_WINDOW_MS = 2000;

/**
 * Pairs mark-key presses with screenshots. A screenshot within the window after a press, or a press
 * within the window after a screenshot, marks that screenshot's position. Each press marks at most
 * one screenshot and each screenshot is marked at most once, so holding the key while tapping the
 * screenshot key is one mark, not one per poll.
 */
export class MarkPairer {
  private pressAt = -Infinity;
  private shotAt = -Infinity;
  private shot: Position | null = null;

  constructor(
    private readonly onMark: (p: Position) => void,
    private readonly windowMs = MARK_WINDOW_MS,
  ) {}

  press(now: number = Date.now()): void {
    if (this.shot && now - this.shotAt <= this.windowMs) {
      const p = this.shot;
      this.shot = null;
      this.onMark(p);
      return;
    }
    this.pressAt = now;
  }

  screenshot(p: Position, now: number = Date.now()): void {
    if (now - this.pressAt <= this.windowMs) {
      this.pressAt = -Infinity;
      this.onMark(p);
      return;
    }
    this.shot = p;
    this.shotAt = now;
  }
}

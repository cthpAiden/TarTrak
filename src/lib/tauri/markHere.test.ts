import { describe, it, expect } from "vitest";
import { MarkPairer } from "./markHere";
import type { Position } from "../parse/screenshot";

const P1: Position = { x: 1, y: 2, z: 3, yaw: 90 };
const P2: Position = { x: 4, y: 5, z: 6, yaw: 180 };

function pairer() {
  const marks: Position[] = [];
  const p = new MarkPairer((pos) => marks.push(pos), 2000);
  return { p, marks };
}

describe("MarkPairer", () => {
  it("marks a screenshot within the window after a press", () => {
    const { p, marks } = pairer();
    p.press(1000);
    p.screenshot(P1, 2500);
    expect(marks).toEqual([P1]);
  });

  it("marks the last screenshot when the press comes within the window after it", () => {
    const { p, marks } = pairer();
    p.screenshot(P1, 1000);
    p.press(2900);
    expect(marks).toEqual([P1]);
  });

  it("ignores a screenshot outside the window", () => {
    const { p, marks } = pairer();
    p.press(1000);
    p.screenshot(P1, 3001);
    expect(marks).toEqual([]);
    p.press(6000);
    expect(marks).toEqual([]);
  });

  it("one press marks one screenshot only", () => {
    const { p, marks } = pairer();
    p.press(1000);
    p.screenshot(P1, 1200);
    p.screenshot(P2, 1400);
    expect(marks).toEqual([P1]);
  });

  it("one screenshot is marked once, however many presses follow", () => {
    const { p, marks } = pairer();
    p.screenshot(P1, 1000);
    p.press(1100);
    p.press(1200);
    expect(marks).toEqual([P1]);
  });

  it("a press that already marked does not also arm the next screenshot", () => {
    const { p, marks } = pairer();
    p.screenshot(P1, 1000);
    p.press(1100);
    p.screenshot(P2, 1200);
    expect(marks).toEqual([P1]);
  });

  it("a later press replaces an expired one", () => {
    const { p, marks } = pairer();
    p.press(1000);
    p.press(5000);
    p.screenshot(P2, 6000);
    expect(marks).toEqual([P2]);
  });
});

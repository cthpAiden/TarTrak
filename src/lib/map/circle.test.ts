import { describe, it, expect } from "vitest";
import {
  angleGap,
  circleLayout,
  circleWindowSize,
  polar,
  rimChips,
  ringAngle,
  unrotate,
  chipAngles,
  CHIP_GAP,
  CHIP_HALF_W,
  EDGE,
  RIM_BUTTON_ANGLES,
  RIM_BUTTON_GAP,
  RIM_BUTTON_SIZE,
  RING,
} from "./circle";

describe("circleWindowSize / circleLayout", () => {
  it("fits the chosen disc exactly in the window sized for it, anchored top-right", () => {
    const { width, height } = circleWindowSize(300);
    const l = circleLayout(width, height, 300);
    expect(l.r).toBeCloseTo(150, 0);
    expect(l.ro).toBeCloseTo(150 + RING, 0);
    expect(width - (l.cx + l.ro)).toBeCloseTo(EDGE, 0);
    expect(l.cy - l.ro).toBe(EDGE);
  });

  it("keeps every rim button and chip inside the window", () => {
    for (const size of [200, 300, 480]) {
      const { width, height } = circleWindowSize(size);
      const l = circleLayout(width, height, size);
      for (const a of RIM_BUTTON_ANGLES) {
        const p = polar(l.cx, l.cy, l.ro + RIM_BUTTON_GAP, a);
        expect(p.x - RIM_BUTTON_SIZE / 2).toBeGreaterThanOrEqual(0);
        expect(p.y + RIM_BUTTON_SIZE / 2).toBeLessThanOrEqual(height);
      }
      for (const a of chipAngles(l.ro)) {
        const p = polar(l.cx, l.cy, l.ro + CHIP_GAP, a);
        expect(p.x + CHIP_HALF_W).toBeLessThanOrEqual(width);
        expect(p.y + 12).toBeLessThanOrEqual(height);
      }
    }
  });

  it("shrinks the disc in a window too small for the chosen size, and not below a floor", () => {
    const big = circleLayout(300, 300, 480);
    expect(big.r).toBeLessThan(240);
    expect(circleLayout(10, 10, 300).r).toBe(60);
  });

  it("keeps the chosen size in a bigger window instead of growing", () => {
    expect(circleLayout(1600, 1000, 300).r).toBe(150);
  });
});

describe("chipAngles", () => {
  it("gives the default size the three slots of the approved design, a bigger disc more", () => {
    expect(chipAngles(150 + RING).map(Math.round)).toEqual([170, 150, 131]);
    expect(chipAngles(100 + RING)).toHaveLength(2);
    expect(chipAngles(240 + RING).length).toBeGreaterThan(3);
  });
});

describe("polar", () => {
  it("measures clockwise from 12 o'clock with screen y down", () => {
    const n = polar(100, 100, 10, 0);
    expect(n.x).toBeCloseTo(100);
    expect(n.y).toBeCloseTo(90);
    const e = polar(100, 100, 10, 90);
    expect(e.x).toBeCloseTo(110);
    expect(e.y).toBeCloseTo(100);
    const s = polar(100, 100, 10, 180);
    expect(s.y).toBeCloseTo(110);
  });
});

describe("ringAngle", () => {
  it("is the bearing when north is up", () => {
    expect(ringAngle(56.5, 65, true)).toBe(56.5);
  });
  it("is relative to my heading when the map turns", () => {
    expect(ringAngle(56.5, 65, false)).toBeCloseTo(-8.5);
    expect(ringAngle(0, 65, false)).toBe(-65);
  });
  it("falls back to the bearing before any heading is known", () => {
    expect(ringAngle(120, null, false)).toBe(120);
  });
});

describe("angleGap", () => {
  it("takes the short way round", () => {
    expect(angleGap(10, 350)).toBe(20);
    expect(angleGap(350, 10)).toBe(20);
    expect(angleGap(0, 180)).toBe(180);
    expect(angleGap(-65, 295)).toBe(0);
  });
});

describe("unrotate", () => {
  it("undoes the map's rotation", () => {
    // The map is drawn turned by -90deg: what was to the right (east) of the centre is now straight up.
    const p = unrotate(0, -10, 90);
    expect(p.x).toBeCloseTo(10);
    expect(p.y).toBeCloseTo(0);
  });
  it("is the identity with no rotation", () => {
    const p = unrotate(3, 4, 0);
    expect(p.x).toBeCloseTo(3);
    expect(p.y).toBeCloseTo(4);
  });
});

describe("rimChips", () => {
  const mate = (id: string, d: number | null) => ({ id, name: id, color: "#fff", distanceM: d });

  it("puts the timer first, then teammates closest first", () => {
    const chips = rimChips("31:42", [mate("Vex", 149), mate("Kilo", 81)], 3);
    expect(chips.map((c) => c.text)).toEqual(["31:42", "81 m", "149 m"]);
    expect(chips[1].title).toBe("Kilo");
  });

  it("works without a timer", () => {
    expect(rimChips(null, [mate("Kilo", 81)], 3).map((c) => c.kind)).toEqual(["mate"]);
  });

  it("folds chips past the last slot into a +N chip that names them", () => {
    const chips = rimChips("10:00", [mate("A", 10), mate("B", 20), mate("C", 30), mate("D", null)], 3);
    expect(chips).toHaveLength(3);
    expect(chips[2]).toMatchObject({ kind: "more", text: "+3" });
    expect(chips[2].title).toBe("B 20 m · C 30 m · D ? m");
  });
});

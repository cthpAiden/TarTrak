import { test } from "node:test";
import assert from "node:assert/strict";
import { HANDOFF } from "../../timeline.ts";
import {
  BOX, HDG, LABELS, MINI, MINOR, RIM, SNAPS, angleGap, boxAngle, boxSlide, chipSlots, labelVis, minorAt, minorStart,
  pad3, polar, ringSpeed, ringTurn, snapFrame, snapIn, stageAt, sway, toScreen,
} from "./shot6.ts";

const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;
const centre = { x: MINI.x, y: MINI.y };

test("f600 hands over from the iris: disc radius 330 round the frame's centre", () => {
  for (const f of [600, 615, 630]) {
    const st = stageAt(f);
    const c = toScreen(st, centre);
    assert.ok(near(c.x, HANDOFF.iris.cx) && near(c.y, HANDOFF.iris.cy), `centre at ${f}`);
    assert.ok(near(MINI.r * st.s, HANDOFF.iris.r), `disc radius at ${f}`);
  }
});

test("pull-back lands the minimap at its natural place and holds it", () => {
  for (const f of [666, 680, 696]) {
    const st = stageAt(f);
    assert.ok(near(st.s, 1) && near(st.x, MINI.x) && near(st.y, MINI.y), `natural at ${f}`);
  }
  // one smooth move in between: the scale only shrinks
  let prev = stageAt(630).s;
  for (let f = 631; f <= 666; f++) {
    const s = stageAt(f).s;
    assert.ok(s <= prev + 1e-12, `scale grows at ${f}`);
    prev = s;
  }
});

test("f719 hands over to the logo: outer bezel radius 270 round the frame's centre", () => {
  const st = stageAt(719);
  const c = toScreen(st, centre);
  assert.ok(near(c.x, HANDOFF.logo.cx) && near(c.y, HANDOFF.logo.cy));
  assert.ok(near(MINI.ro * st.s, HANDOFF.logo.r));
  assert.ok(near(MINI.r + 26, MINI.ro));
});

test("the push-in accelerates into the cut", () => {
  const step = (f: number) => {
    const a = toScreen(stageAt(f), centre), b = toScreen(stageAt(f + 1), centre);
    return Math.hypot(b.x - a.x, b.y - a.y);
  };
  assert.ok(step(718) > 3 * step(708));
  assert.ok(step(697) < 2);
});

test("ring speed: still on the corner, fastest just before the cut, nothing after it", () => {
  assert.ok(ringSpeed(680) < 1e-6);
  assert.ok(ringSpeed(698) < 3);
  assert.ok(ringSpeed(718) > 100);
  assert.ok(ringSpeed(718) > ringSpeed(714));
  assert.ok(ringSpeed(640) > 10 && ringSpeed(640) < ringSpeed(648));
  assert.equal(ringSpeed(725), 0);
});

test("minor ticks: nothing on f600, three new ticks a frame, all 72 in by 624 and settled after", () => {
  assert.equal(MINOR.n, 72);
  for (let k = 0; k < 72; k++) assert.equal(minorAt(600, k).o, 0);
  for (let f = 601; f <= 624; f++) {
    const started = Array.from({ length: 72 }, (_, k) => minorStart(k) < f).filter(Boolean).length;
    assert.equal(started, Math.min(72, (f - 600) * 3), `started by ${f}`);
  }
  for (let k = 0; k < 72; k++) {
    const t = minorAt(645, k);
    assert.ok(t.off < 0.01 && t.o === 1, `tick ${k} settled`);
  }
  // they fly in from outside: further out when they start than a frame later
  assert.ok(minorAt(601, 0).off < MINOR.dist && minorAt(601, 0).off > minorAt(602, 0).off);
});

test("majors and labels snap by quadrant on the tick cues: N 624, E 627, S 630, W 633", () => {
  assert.deepEqual([...SNAPS], [624, 627, 630, 633]);
  assert.deepEqual([0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(snapFrame), [624, 624, 624, 627, 627, 627, 630, 630, 630, 633, 633, 633]);
  assert.equal(snapIn(620, 624), 0);
  assert.equal(snapIn(624, 624), 1);
  assert.ok(snapIn(623, 624) > 0 && snapIn(623, 624) < 0.6);
});

test("heading box: pops in on N, lands on 048 with the pop cue, settles by 650", () => {
  assert.equal(boxSlide(BOX.appear), 0);
  assert.ok(near(boxSlide(645), HDG));
  assert.ok(boxSlide(644) < HDG && boxSlide(644) > 30);
  const over = Math.max(boxSlide(646), boxSlide(647));
  assert.ok(over > HDG + 1 && over < HDG + 5, `overshoot ${over}`);
  for (const f of [650, 660, 683]) assert.ok(near(boxSlide(f), HDG, 1e-6));
  assert.equal(pad3(HDG), "048");
  assert.equal(pad3(0), "000");
});

test("heading-up turns the ring -48° under the box, which ends at 12 o'clock", () => {
  assert.equal(ringTurn(684), 0);
  assert.ok(near(ringTurn(704), -HDG));
  assert.ok(near(boxAngle(683), HDG, 1e-6));
  assert.ok(near(boxAngle(704), 0, 1e-6));
  // the box rides the ring: on the ring's own scale it always reads 048
  for (const f of [684, 690, 697, 704]) assert.ok(near(boxAngle(f) - ringTurn(f), HDG, 1e-6));
});

test("labels under the heading box hide like the app's (within 13°)", () => {
  assert.equal(labelVis(60, 48), 0);
  assert.equal(labelVis(30, 48), 1);
  assert.equal(labelVis(0, 0), 0);
  assert.equal(labelVis(0, 48), 1);
  assert.ok(near(angleGap(350, 10), 20) && near(angleGap(-48, 312), 0));
  assert.equal(LABELS.length, 12);
  assert.deepEqual(LABELS.filter((l) => l.letter).map((l) => l.text), ["N", "E", "S", "W"]);
});

test("polar matches the app: clockwise from 12 o'clock, y down", () => {
  const p = polar(0, 0, 10, 90);
  assert.ok(near(p.x, 10) && near(p.y, 0));
  const q = polar(0, 0, 10, 180);
  assert.ok(near(q.x, 0) && near(q.y, 10));
});

test("chips step up the lower-right arc from 170°, clear of the ring, of each other and of the frame's HUD margin", () => {
  const halves = [38.5, 31.4, 31.4, 35];
  const slots = chipSlots(MINI.ro, halves, 13);
  assert.equal(slots.length, 4);
  assert.equal(slots[0].deg, 170);
  const boxes = slots.map((sl, i) => {
    const c = polar(0, 0, sl.radius, sl.deg);
    return { x0: c.x - halves[i], x1: c.x + halves[i], y0: c.y - 13, y1: c.y + 13 };
  });
  boxes.forEach((b, i) => {
    assert.ok(slots[i].radius >= MINI.ro + 16, `chip ${i} closer than the app's gap`);
    const nx = Math.max(b.x0, 0, -b.x1), ny = Math.max(b.y0, 0, -b.y1);
    assert.ok(Math.hypot(nx, ny) >= MINI.ro + 3 - 1e-9, `chip ${i} on the ring`);
    assert.ok(MINI.x + b.x1 <= 1920 - 48, `chip ${i} past the HUD margin`);
    if (i > 0) {
      assert.ok(slots[i].deg < slots[i - 1].deg && slots[i].deg > 90, `chip ${i} not stepping up`);
      const p = boxes[i - 1];
      const apart = b.x0 >= p.x1 + 3 || b.x1 <= p.x0 - 3 || b.y1 <= p.y0 - 3 || b.y0 >= p.y1 + 3;
      assert.ok(apart, `chip ${i} overlaps chip ${i - 1}`);
    }
  });
});

test("rim buttons: the app's five angles, 3 frames apart from 664", () => {
  assert.deepEqual([...RIM.angles], [190, 212, 234, 256, 278]);
  assert.deepEqual([...RIM.at], [664, 667, 670, 673, 676]);
});

test("handheld sway stays within ±6 px and ±0.3°, moves smoothly and is repeatable", () => {
  let prev = sway(600);
  for (let f = 600; f <= 720; f += 0.5) {
    const s = sway(f);
    assert.ok(Math.abs(s.x) <= 6 && Math.abs(s.y) <= 6 && Math.abs(s.rot) <= 0.3, `bounds at ${f}`);
    assert.ok(Math.abs(s.x - prev.x) < 0.6 && Math.abs(s.y - prev.y) < 0.6, `jump at ${f}`);
    prev = s;
  }
  assert.deepEqual(sway(650), sway(650));
});

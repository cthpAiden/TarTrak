import { test } from "node:test";
import assert from "node:assert/strict";
import { CAM_S2_START, CAM_S4_START, camAt, project, type Cam } from "../world/camera.ts";
import { EXTRACTS, MATES, ME, revealRadius } from "../world/data.ts";
import { MAP_CAM, ROOM_LOCKS, landingBump } from "./mapCam.ts";

const W = 1920, H = 1080;
const cam = (f: number) => camAt(f, MAP_CAM);
const onScreen = (c: Cam, p: { x: number; y: number }, m: number) => {
  const q = project(c, p, W, H);
  return q.x >= m && q.x <= W - m && q.y >= m && q.y <= H - m;
};
/** Headline text blocks (x 120, last baseline 960, 150 px) and the room code panel, with the frames they are up. */
const HEADLINE_2 = { x0: 100, x1: 840, y0: 690, y1: 1015, f0: 150, f1: 234 };
const HEADLINE_3 = { x0: 100, x1: 1010, y0: 690, y1: 975, f0: 270, f1: 344 };
const ROOM = { x0: 720, x1: 1200, y0: 70, y1: 215, f0: 240, f1: 340 };
const inside = (q: { x: number; y: number }, b: typeof ROOM) => q.x > b.x0 && q.x < b.x1 && q.y > b.y0 && q.y < b.y1;

test("the track hands off exactly: CAM_S2_START at f120, CAM_S4_START at f359", () => {
  assert.deepEqual(cam(120), CAM_S2_START);
  assert.deepEqual(cam(359), CAM_S4_START);
  assert.deepEqual(cam(100), CAM_S2_START);
  assert.deepEqual(cam(400), CAM_S4_START);
  assert.deepEqual(MAP_CAM.map(([f]) => f), Array.from({ length: 240 }, (_, i) => 120 + i));
});

test("every extract is on screen when it pops and stays there until the whip", () => {
  for (const e of EXTRACTS)
    for (let f = e.popAt; f <= 222; f++) assert.ok(onScreen(cam(f), e, 40), `${e.id} off screen at f${f}`);
});

test("every teammate is on screen from its landing to the flatten", () => {
  for (const m of MATES)
    for (let f = m.landAt; f <= 330; f++) assert.ok(onScreen(cam(f), m, 60), `${m.id} off screen at f${f}`);
});

test("the reveal ring stays in frame while it sweeps (f122-185)", () => {
  for (let f = 122; f <= 185; f++) {
    const R = revealRadius(f);
    let n = 0;
    for (let a = 0; a < 360; a += 2) {
      const t = (a * Math.PI) / 180;
      if (onScreen(cam(f), { x: ME.x + R * Math.cos(t), y: ME.y + R * Math.sin(t) }, 0)) n++;
    }
    assert.ok(n / 180 >= 0.4, `only ${Math.round((n / 180) * 100)}% of the ring in frame at f${f}`);
  }
});

test("no extract or teammate sits under a headline or the room code while they are up", () => {
  for (let f = HEADLINE_2.f0; f <= HEADLINE_2.f1; f++)
    for (const e of EXTRACTS.filter((x) => f >= x.popAt)) assert.ok(!inside(project(cam(f), e, W, H), HEADLINE_2), `${e.id} under the headline at f${f}`);
  for (const m of MATES)
    for (let f = m.landAt; f <= 344; f++) {
      const q = project(cam(f), m, W, H);
      if (f >= HEADLINE_3.f0) assert.ok(!inside(q, HEADLINE_3), `${m.id} under the headline at f${f}`);
      if (f <= ROOM.f1) assert.ok(!inside(q, ROOM), `${m.id} under the room code at f${f}`);
    }
});

test("the camera has no kinks where its segments join", () => {
  const ch = (f: number) => {
    const c = cam(f);
    return [Math.log(c.zoom), c.tilt, c.turn, c.x, c.y];
  };
  const v = (f: number, k: number) => ch(f + 1)[k] - ch(f)[k];
  for (let k = 0; k < 5; k++) {
    let peak = 0;
    for (let f = 120; f < 359; f++) peak = Math.max(peak, Math.abs(v(f, k)));
    for (const key of [150, 165, 200, 224, 256, 330]) {
      const jump = Math.abs(v(key, k) - v(key - 1, k));
      assert.ok(jump <= 0.06 * peak, `channel ${k} jumps ${(jump / peak).toFixed(3)} of its peak speed at f${key}`);
    }
  }
});

test("the room code locks on the 16ths from beat 8", () => {
  assert.deepEqual(ROOM_LOCKS, [240, 248, 255, 263, 270, 278]);
});

test("the landing bump only moves after a landing and dies out before the next", () => {
  for (const f of [240, 269, 270, 285, 300, 315, 340]) assert.equal(landingBump(f), 0, `bump at f${f}`);
  for (const m of MATES) {
    assert.ok(landingBump(m.landAt + 1) > 0.3, `${m.id} lands without a bump`);
    assert.ok(Math.abs(landingBump(m.landAt + 14)) < 0.05, `${m.id} bump still moving at +14`);
  }
});

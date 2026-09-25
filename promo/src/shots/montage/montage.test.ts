import { test } from "node:test";
import assert from "node:assert/strict";
import { CAM_IRIS, project } from "../../world/camera.ts";
import { EXTRACTS, ME, STROKE } from "../../world/data.ts";
import { HANDOFF } from "../../timeline.ts";
import { CUTS, cutAt, drawCam, drawScale, irisRadius, letterFill, routeCam, strokeHead, zoomBetween } from "./montage.ts";

const near = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);

test("cuts land on the beats of bar 5", () => {
  assert.deepEqual(CUTS.map((c) => c.at), [480, 510, 540, 570]);
  assert.deepEqual(cutAt(480), { index: 0, local: 0 });
  assert.deepEqual(cutAt(509), { index: 0, local: 29 });
  assert.deepEqual(cutAt(510), { index: 1, local: 0 });
  assert.deepEqual(cutAt(569), { index: 2, local: 29 });
  assert.deepEqual(cutAt(599), { index: 3, local: 29 });
});

test("letters fill one after another and the word is full before the cut", () => {
  for (const n of [4, 5, 6]) {
    assert.equal(letterFill(0, n, 1), 0);
    assert.ok(letterFill(0, n, 3) > 0);
    assert.equal(letterFill(n - 1, n, 25), 1);
    for (let i = 1; i < n; i++) {
      // letter i starts only once letter i - 1 is well on its way
      const start = Array.from({ length: 30 }, (_, f) => f).find((f) => letterFill(i, n, f) > 0)!;
      assert.ok(letterFill(i - 1, n, start) > 0.4, `n ${n} letter ${i}`);
    }
  }
});

test("zoomBetween keeps its end cameras and moves every point on a straight line", () => {
  const a = { x: 1590, y: 1320, zoom: 2.05, tilt: 0, turn: 0 };
  const b = CAM_IRIS;
  assert.deepEqual(zoomBetween(a, b, 0), a);
  assert.deepEqual(zoomBetween(a, b, 1), b);
  const mid = zoomBetween(a, b, 0.5);
  near(mid.zoom, Math.sqrt(a.zoom * b.zoom));
  // a map point's screen track is straight: its position at 0.5 lies on the segment between its ends
  const p = { x: 1650, y: 1320 };
  const [p0, p1, pm] = [a, b, mid].map((c) => project(c, p, 1920, 1080));
  const cross = (p1.x - p0.x) * (pm.y - p0.y) - (p1.y - p0.y) * (pm.x - p0.x);
  near(cross, 0, 1e-6);
});

test("the draw close-up's 2x hero scale eases to 1x (shot 6's minimap is at screen resolution) by 599", () => {
  assert.equal(drawScale(570), 2);
  assert.equal(drawScale(585), 2);
  assert.equal(drawScale(599), 1);
  for (let f = 586; f <= 599; f++) assert.ok(drawScale(f) <= drawScale(f - 1), `frame ${f}`);
});

test("the draw cut ends exactly on the hand-off camera and circle", () => {
  assert.deepEqual(drawCam(599), CAM_IRIS);
  near(drawCam(570).zoom, 2.0);
  assert.equal(irisRadius(599), HANDOFF.iris.r);
});

test("the iris opens at the frame corners at 580 and slams shut, fastest into 599", () => {
  const corner = Math.hypot(960, 540);
  // nothing clipped before and at 580
  for (const f of [570, 579, 580]) assert.ok(irisRadius(f) >= corner && irisRadius(f) <= corner + 3, `frame ${f}: ${irisRadius(f)}`);
  // strictly closing, and every frame's step bigger than the one before (accelerating)
  let step = 0;
  for (let f = 581; f <= 599; f++) {
    const d = irisRadius(f - 1) - irisRadius(f);
    assert.ok(d > step, `frame ${f}: step ${d} after ${step}`);
    step = d;
  }
  // the corners are visibly eaten by 586 and it is clearly closing at 588
  assert.ok(irisRadius(586) < corner - 40, `586: ${irisRadius(586)}`);
  assert.ok(irisRadius(588) < 1000, `588: ${irisRadius(588)}`);
  assert.equal(irisRadius(599), HANDOFF.iris.r);
});

test("the route camera looks up the route: tilt 35, turn 35, zoom 1.3 to 1.45", () => {
  const ng = EXTRACTS.find((e) => e.id === "north-gate")!;
  const [c0, c1] = [routeCam(480), routeCam(509)];
  assert.equal(c0.tilt, 35);
  assert.equal(c0.turn, 35);
  near(c0.zoom, 1.3);
  near(c1.zoom, 1.45);
  // me low in frame at the cut, the gate high in frame at its end, the route near-vertical right of centre
  const me0 = project(c0, ME, 1920, 1080), ng1 = project(c1, ng, 1920, 1080);
  assert.ok(me0.y > 600 && me0.y < 900, `me at ${me0.y}`);
  assert.ok(ng1.y > 200 && ng1.y < 420, `gate at ${ng1.y}`);
  assert.ok(ng1.x > 1000 && me0.x > 1000, "right of the word");
  assert.ok(Math.abs(project(c1, ME, 1920, 1080).x - ng1.x) < 200, "near-vertical");
});

test("the pen tip rides the head of NOMAD's stroke", () => {
  const first = STROKE.pts[0], last = STROKE.pts[STROKE.pts.length - 1];
  const h0 = strokeHead(STROKE.drawFrom), h1 = strokeHead(STROKE.drawTo);
  near(h0.x, first.x, 0.01);
  near(h0.y, first.y, 0.01);
  near(h1.x, last.x, 0.01);
  near(h1.y, last.y, 0.01);
});

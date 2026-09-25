import { test } from "node:test";
import assert from "node:assert/strict";
import { CAM_S4_START } from "../../world/camera.ts";
import { MATES } from "../../world/data.ts";
import {
  IDENTITY, NOMAD, NORTH_GATE, PANEL_W, PUSH, RAIL_W, ROUTE_BTN, STATUS_H, TOOLBAR_X, WIN_H, WIN_W,
  floatPose, liftedAnchor, mapBox, mapCam, pose, projectWin, raidClock, worldToWin,
} from "./motion.ts";

const near = (a: number, b: number, eps: number, what: string) => assert.ok(Math.abs(a - b) <= eps, `${what}: ${a} vs ${b}`);

test("f360 is shot 3's last frame: full-frame World at CAM_S4_START, window untransformed", () => {
  assert.deepEqual(mapCam(360), CAM_S4_START);
  assert.deepEqual(mapBox(360), { x: 0, y: 0, w: WIN_W, h: WIN_H });
  assert.deepEqual(pose(360), IDENTITY);
  const p = projectWin({ x: 123, y: 456 }, pose(360));
  near(p.x, 123, 1e-9, "x");
  near(p.y, 456, 1e-9, "y");
});

test("the camera holds CAM_S4_START while the viewport shrinks into the map area", () => {
  for (const f of [360, 366, 372, 378, 380]) assert.deepEqual(mapCam(f), CAM_S4_START);
  const box = mapBox(400);
  near(box.x, RAIL_W + PANEL_W, 1e-6, "map left");
  near(box.h, WIN_H - STATUS_H, 1e-6, "map bottom");
});

test("the raid clock starts at 31:59 and ticks once a second", () => {
  assert.equal(raidClock(360), "31:59");
  assert.equal(raidClock(419.9), "31:59");
  assert.equal(raidClock(420), "31:58");
  assert.equal(raidClock(479), "31:58");
});

test("the route button is the toolbar's third button (app.css geometry)", () => {
  assert.deepEqual(ROUTE_BTN, { x: 1886, y: 106 });
  assert.equal(TOOLBAR_X, 1864);
});

test("the float follows the brief's keys", () => {
  near(floatPose(372).s, 1, 1e-9, "scale at 372");
  near(floatPose(440).s, 0.78, 1e-9, "scale at 440");
  near(floatPose(408).ry, -18, 1e-9, "rotateY peak");
  near(floatPose(446).ry, -6, 1e-9, "rotateY settled");
  near(floatPose(408).rx, 6, 1e-9, "rotateX peak");
  near(floatPose(446).rx, 2, 1e-9, "rotateX settled");
});

test("the floating window never leaves the frame", () => {
  const corners = [{ x: 0, y: 0 }, { x: WIN_W, y: 0 }, { x: WIN_W, y: WIN_H }, { x: 0, y: WIN_H }];
  for (let f = 372; f <= PUSH.from; f += 0.5) {
    for (const c of corners) {
      const p = projectWin(c, pose(f));
      assert.ok(p.x >= -0.5 && p.x <= WIN_W + 0.5 && p.y >= -0.5 && p.y <= WIN_H + 0.5, `corner ${c.x},${c.y} at f${f}: ${p.x}, ${p.y}`);
    }
  }
});

test("NOMAD, the whole squad and NORTH GATE are inside the map area for their callouts", () => {
  const inside = (f: number, p: { x: number; y: number }, pad: number) => {
    const b = mapBox(f);
    return p.x > b.x + pad && p.x < TOOLBAR_X - pad && p.y > b.y + pad && p.y < b.y + b.h - pad;
  };
  for (let f = 390; f <= 450; f += 5) {
    for (const m of MATES) assert.ok(inside(f, worldToWin(m, f), 40), `${m.id} at f${f}`);
    assert.ok(inside(f, worldToWin(NOMAD, f), 40), `NOMAD at f${f}`);
  }
  for (let f = 420; f <= 450; f += 5) assert.ok(inside(f, worldToWin(NORTH_GATE, f), 60), `NORTH GATE at f${f}`);
});

test("a callout 40 px in front of the window keeps its dot on its target", () => {
  const targets = [{ x: 1564, y: 100 }, { x: 431, y: 1065 }, { x: 1137, y: 975 }, { x: 960, y: 540 }];
  for (const f of [390, 408, 425, 446, 458]) {
    const o = pose(f);
    for (const p of targets) {
      const want = projectWin(p, o, 0), got = projectWin(liftedAnchor(p, o, 40), o, 40);
      near(got.x, want.x, 0.01, `x of ${p.x},${p.y} at f${f}`);
      near(got.y, want.y, 0.01, `y of ${p.x},${p.y} at f${f}`);
    }
  }
});

test("the push is continuous, flattens, and brings the route button to the frame centre", () => {
  const a = pose(PUSH.from), b = pose(PUSH.from + 1e-4);
  for (const k of ["s", "rx", "ry", "tx", "ty"] as const) near(b[k], a[k], 1e-2, k);
  const flat = pose(PUSH.flat + 1);
  assert.equal(flat.rx, 0);
  assert.equal(flat.ry, 0);
  // a straight dolly: the button's distance from the frame centre shrinks steadily, never overshooting
  let last = Infinity;
  for (let f = PUSH.from; f <= PUSH.to; f += 0.5) {
    const p = projectWin(ROUTE_BTN, pose(f));
    const d = Math.hypot(p.x - WIN_W / 2, p.y - WIN_H / 2);
    assert.ok(d <= last + 1e-6, `button distance grows at ${f}`);
    last = d;
  }
  const end = projectWin(ROUTE_BTN, pose(PUSH.to));
  near(end.x, WIN_W / 2, 1e-6, "button x at the cut");
  near(end.y, WIN_H / 2, 1e-6, "button y at the cut");
  const at476 = projectWin(ROUTE_BTN, pose(476));
  assert.ok(pose(476).s * 34 > 400 && Math.abs(at476.x - WIN_W / 2) < 200 && Math.abs(at476.y - WIN_H / 2) < 120, "476 is dominated by the button");
  assert.ok(pose(479).s > 20, "the button fills the frame by the cut");
});

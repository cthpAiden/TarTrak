import { test } from "node:test";
import assert from "node:assert/strict";
import { camAt, project, project3d } from "./camera.ts";

const flat = { x: 100, y: 100, zoom: 2, tilt: 0, turn: 0 };

test("flat camera: the focus is the view centre, zoom scales offsets", () => {
  const c = project(flat, { x: 100, y: 100 }, 1920, 1080);
  assert.deepEqual([c.x, c.y], [960, 540]);
  const r = project(flat, { x: 110, y: 100 }, 1920, 1080);
  assert.ok(Math.abs(r.x - 980) < 1e-9 && Math.abs(r.y - 540) < 1e-9);
});

test("turn 90 (heading-up facing east) puts north on the left", () => {
  const p = project({ ...flat, turn: 90 }, { x: 100, y: 90 }, 1920, 1080);
  assert.ok(p.x < 960 - 19 && Math.abs(p.y - 540) < 1e-6);
});

test("tilt pushes the far (north) side away and makes it smaller", () => {
  const far = project({ ...flat, tilt: 55 }, { x: 100, y: 50 }, 1920, 1080);
  const nearP = project({ ...flat, tilt: 55 }, { x: 100, y: 150 }, 1920, 1080);
  assert.ok(far.s < 1 && nearP.s > 1);
  assert.ok(540 - far.y < nearP.y - 540);
});

// Extra helper for World.tsx (not in the brief): markers drawn in screen space, lifted off the ground.
test("project3d matches project on the ground and lifts points toward the camera", () => {
  const cam = { x: 100, y: 100, zoom: 2, tilt: 50, turn: -30 };
  const p = { x: 130, y: 70 };
  const a = project(cam, p, 1920, 1080), b = project3d(cam, p, 0, 1920, 1080);
  assert.ok(Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9 && Math.abs(a.s - b.s) < 1e-9);
  const up = project3d(cam, p, 40, 1920, 1080);
  assert.ok(up.y < b.y && up.s > b.s);
  const q = project3d(flat, { x: 110, y: 100 }, 90, 1920, 1080);
  assert.ok(Math.abs(q.s - 1800 / 1620) < 1e-9 && Math.abs(q.x - (960 + 20 * q.s)) < 1e-9 && Math.abs(q.y - 540) < 1e-9);
});

test("camAt interpolates every field and holds at the ends", () => {
  const keys = [[0, { x: 0, y: 0, zoom: 1, tilt: 0, turn: 0 }], [10, { x: 10, y: 20, zoom: 3, tilt: 50, turn: -20 }]] as const;
  assert.deepEqual(camAt(-1, keys), keys[0][1]);
  assert.deepEqual(camAt(99, keys), keys[1][1]);
  const mid = camAt(5, keys);
  assert.ok(mid.x > 0 && mid.x < 10 && mid.zoom > 1 && mid.zoom < 3);
});

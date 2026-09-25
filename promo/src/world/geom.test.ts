import { test } from "node:test";
import assert from "node:assert/strict";
import { convexHull, extendEnds, offsetLine, sampleSmooth, smoothPath, stations } from "./geom.ts";

const nums = (d: string) => [...d.matchAll(/-?\d+(?:\.\d+)?(?:e-?\d+)?/g)].map((m) => Number(m[0]));

test("smoothPath passes through every point and keeps a straight line straight", () => {
  const pts = [{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 20 }, { x: 40, y: 40 }];
  const d = smoothPath(pts);
  assert.ok(d.startsWith("M0 0"));
  const c = nums(d);
  for (let i = 0; i < c.length; i += 2) assert.ok(Math.abs(c[i] - c[i + 1]) < 1e-6, "every control point on y = x");
  for (const p of pts) assert.ok(d.includes(`${p.x} ${p.y}`), `passes through ${p.x},${p.y}`);
});

test("smoothPath closes a loop", () => {
  const d = smoothPath([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }], true);
  assert.ok(d.endsWith("Z"));
  assert.equal((d.match(/C/g) ?? []).length, 4);
});

test("sampleSmooth follows the curve from end to end", () => {
  const line = sampleSmooth([{ x: 0, y: 5 }, { x: 50, y: 5 }, { x: 100, y: 5 }], false, 8);
  assert.deepEqual(line[0], { x: 0, y: 5 });
  assert.deepEqual(line[line.length - 1], { x: 100, y: 5 });
  assert.equal(line.length, 17);
  for (const p of line) assert.ok(Math.abs(p.y - 5) < 1e-9);
});

test("offsetLine shifts a straight line sideways by d", () => {
  const a = offsetLine([{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 }], 4);
  const b = offsetLine([{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 }], -4);
  for (let i = 0; i < 3; i++) {
    assert.ok(Math.abs(Math.abs(a[i].y - b[i].y) - 8) < 1e-9);
    assert.ok(Math.abs(a[i].x - i * 50) < 1e-9);
  }
});

test("stations sit every `every` units along the line with unit normals", () => {
  const s = stations([{ x: 0, y: 0 }, { x: 100, y: 0 }], 20);
  assert.deepEqual(s.map((p) => Math.round(p.x)), [10, 30, 50, 70, 90]);
  for (const p of s) assert.ok(Math.abs(Math.hypot(p.nx, p.ny) - 1) < 1e-9 && Math.abs(p.nx) < 1e-9);
});

test("convexHull drops interior points", () => {
  const h = convexHull([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 5 }, { x: 10, y: 10 }, { x: 0, y: 10 }]);
  assert.equal(h.length, 4);
  assert.ok(!h.some((p) => p.x === 5 && p.y === 5));
});

test("extendEnds pushes both ends outward along the end segments", () => {
  const e = extendEnds([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 5 }], 100);
  assert.equal(e.length, 5);
  assert.deepEqual(e[0], { x: -100, y: 0 });
  const last = e[e.length - 1];
  assert.ok(Math.abs(Math.hypot(last.x - 20, last.y - 5) - 100) < 1e-9 && last.x > 20 && last.y > 5);
});

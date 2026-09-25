import { test } from "node:test";
import assert from "node:assert/strict";
import { HILLS, SUN, contourLines, contourPath, groundTone, heightAt, toneGrid } from "./terrain.ts";

const coords = (d: string) => [...d.matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));

test("a linear field gives a straight iso-line", () => {
  const d = contourPath(50, 10, 100, 100, (x) => x);
  const xs = coords(d).filter((_, i) => i % 2 === 0);
  assert.ok(xs.length > 0);
  for (const x of xs) assert.ok(Math.abs(x - 50) < 1e-6);
});

test("a radial field gives a circle", () => {
  const d = contourPath(30, 5, 100, 100, (x, y) => Math.hypot(x - 50, y - 50));
  const c = coords(d);
  for (let i = 0; i < c.length; i += 2) assert.ok(Math.abs(Math.hypot(c[i] - 50, c[i + 1] - 50) - 30) < 1.5);
});

test("heightAt is smooth and bounded", () => {
  for (let x = 0; x <= 3000; x += 250) for (let y = 0; y <= 2000; y += 250) {
    const h = heightAt(x, y);
    assert.ok(h >= 0 && h <= 1.5);
  }
});

// Extra helpers for World.tsx (not in the brief).

test("contourLines joins a circle into one closed ring", () => {
  const lines = contourLines(30, 5, 100, 100, (x, y) => Math.hypot(x - 50, y - 50));
  assert.equal(lines.length, 1);
  assert.equal(lines[0].closed, true);
  assert.ok(lines[0].pts.length > 20);
  for (const p of lines[0].pts) assert.ok(Math.abs(Math.hypot(p.x - 50, p.y - 50) - 30) < 1.5);
});

test("contourLines joins a straight iso-line into one open line", () => {
  const lines = contourLines(50, 10, 100, 100, (x) => x);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].closed, false);
  assert.equal(lines[0].pts.length, 11);
  for (const p of lines[0].pts) assert.ok(Math.abs(p.x - 50) < 1e-6);
});

test("groundTone lights the slopes facing the sun and shades the far side", () => {
  const [hill] = HILLS;
  const a = (SUN.az * Math.PI) / 180, dx = Math.sin(a) * 320, dy = -Math.cos(a) * 320;
  assert.ok(groundTone(hill.x + dx, hill.y + dy) > groundTone(hill.x - dx, hill.y - dy) + 0.05);
  assert.ok(SUN.az > 180 && SUN.az < 270, "lit from the west-south-west, like the buildings");
  for (let x = -1000; x <= 4000; x += 250) for (let y = -1000; y <= 3000; y += 250) {
    const t = groundTone(x, y);
    assert.ok(t > 0.6 && t < 1.4, `${t}`);
  }
});

test("toneGrid samples groundTone on a grid", () => {
  const g = toneGrid(100, 200, 5, 30, 20);
  assert.equal(g.length, 600);
  for (const [i, j] of [[0, 0], [7, 3], [29, 19]]) assert.ok(Math.abs(g[j * 30 + i] - groundTone(100 + i * 5, 200 + j * 5)) < 1e-4);
});

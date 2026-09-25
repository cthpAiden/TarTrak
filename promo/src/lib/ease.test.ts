import { test } from "node:test";
import assert from "node:assert/strict";
import { bezier, clamp, easeOutExpo, lerp, prog, track } from "./ease.ts";

test("clamp and lerp", () => {
  assert.equal(clamp(2), 1);
  assert.equal(clamp(-1), 0);
  assert.equal(lerp(10, 20, 0.5), 15);
});

test("bezier matches the endpoints and linear for (0,0,1,1)", () => {
  const lin = bezier(0, 0, 1, 1);
  for (const x of [0, 0.25, 0.5, 0.9, 1]) assert.ok(Math.abs(lin(x) - x) < 1e-4);
  assert.equal(easeOutExpo(0), 0);
  assert.equal(easeOutExpo(1), 1);
  assert.ok(easeOutExpo(0.2) > 0.6, "expo out is front-loaded");
});

test("prog is 0 before, 1 after, eased between", () => {
  assert.equal(prog(5, 10, 20), 0);
  assert.equal(prog(25, 10, 20), 1);
  assert.equal(prog(15, 10, 20), 0.5);
});

test("track holds outside its keys and interpolates inside", () => {
  const k = [[0, 0], [10, 100], [20, 100]] as const;
  assert.equal(track(-5, k), 0);
  assert.equal(track(30, k), 100);
  assert.equal(track(15, k), 100);
  const mid = track(5, [[0, 0, (t: number) => t], [10, 100]]);
  assert.equal(mid, 50);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { BUILDINGS, EXTRACTS, ME, MATES, REVEAL, ROUTE_TARGET, WORLD_H, WORLD_W, bearingDeg, distM, fromBearing, revealFrame, revealRadius } from "./data.ts";

const near = (a: number, b: number, eps = 0.5) => Math.abs(a - b) <= eps;

test("fromBearing: north is up, east is right, 0.5 m per unit", () => {
  const n = fromBearing({ x: 0, y: 0 }, 0, 10);
  assert.ok(near(n.x, 0) && near(n.y, -20));
  const e = fromBearing({ x: 0, y: 0 }, 90, 10);
  assert.ok(near(e.x, 20) && near(e.y, 0));
});

test("bearing and distance invert fromBearing", () => {
  const p = fromBearing(ME, 35, 412);
  assert.ok(near(bearingDeg(ME, p), 35, 0.01));
  assert.ok(near(distM(ME, p), 412, 0.01));
});

test("teammates sit at the spec distances", () => {
  const m = Object.fromEntries(MATES.map((x) => [x.id, Math.round(distM(ME, x))]));
  assert.deepEqual(m, { ghost: 47, nomad: 84, vex: 132 });
});

test("the route target is NORTH GATE, 412 m away", () => {
  const t = EXTRACTS.find((e) => e.id === ROUTE_TARGET)!;
  assert.equal(t.name, "NORTH GATE");
  assert.equal(Math.round(distM(ME, t)), 412);
});

test("everything is inside the world and buildings avoid me", () => {
  for (const p of [...EXTRACTS, ...MATES, ...BUILDINGS]) {
    assert.ok(p.x > 0 && p.x < WORLD_W && p.y > 0 && p.y < WORLD_H);
  }
  for (const b of BUILDINGS) assert.ok(distM(ME, b) > 20, "no building on top of the player");
  assert.ok(BUILDINGS.length >= 40 && BUILDINGS.length <= 70, `${BUILDINGS.length} buildings`);
});

test("reveal grows from 0 to the whole map and revealFrame inverts it", () => {
  assert.equal(revealRadius(REVEAL.from - 1), 0);
  assert.equal(revealRadius(REVEAL.to + 5), REVEAL.radius);
  const p = { x: ME.x + 600, y: ME.y };
  const f = revealFrame(p);
  assert.ok(f > REVEAL.from && f < REVEAL.to);
  assert.ok(revealRadius(f) >= 600 && revealRadius(f - 1) < 600);
});

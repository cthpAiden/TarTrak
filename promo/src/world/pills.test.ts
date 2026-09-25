import { test } from "node:test";
import assert from "node:assert/strict";
import { markerBoxes, measurePills, type Box } from "./pills.ts";
import { ME, WORLD_H, WORLD_W } from "./data.ts";
import type { Cam } from "./camera.ts";

const overlap = (a: Box, b: Box) =>
  Math.max(0, Math.min(a.x + a.w / 2, b.x + b.w / 2) - Math.max(a.x - a.w / 2, b.x - b.w / 2)) *
  Math.max(0, Math.min(a.y + a.h / 2, b.y + b.h / 2) - Math.max(a.y - a.h / 2, b.y - b.h / 2));

/** Shot 3's planned camera (timeline MAP_CAM, linear from f256 to f330). */
const shot3 = (f: number): Cam => {
  const t = (f - 256) / 74;
  return { x: ME.x + 30, y: ME.y - 40, zoom: 1.9 + 0.2 * t, tilt: 50, turn: -60 - 10 * t };
};
/** WorldTest's WorldTilt camera: the whole map, far out, the three teammates 45-110 px from me. */
const overview: Cam = { x: WORLD_W / 2, y: WORLD_H / 2 + 150, zoom: 0.62, tilt: 52, turn: -12 };

const cases: Array<[string, Cam]> = [
  ["shot 3 f305", shot3(305)],
  ["shot 3 f320", shot3(320)],
  ["shot 3 f330", shot3(330)],
  ["overview", overview],
];

for (const [name, cam] of cases) {
  test(`${name}: all three metre pills show, clear of each other, the dots and the name labels`, () => {
    const pills = measurePills(cam, 1920, 1080);
    assert.deepEqual(pills.map((p) => p.id).sort(), ["ghost", "nomad", "vex"]);
    for (const p of pills) assert.equal(p.fade, 1, `${p.id} fully shown`);
    const markers = markerBoxes(cam, 1920, 1080);
    for (const p of pills) {
      for (const m of markers) assert.equal(overlap(p, m), 0, `${p.id} pill vs ${m.what}`);
      for (const q of pills) if (q !== p) assert.equal(overlap(p, q), 0, `${p.id} pill vs ${q.id} pill`);
      assert.ok(p.x > 0 && p.x < 1920 && p.y > 0 && p.y < 1080, `${p.id} on screen`);
    }
  });
}

test("a pill sits on its own line when there is room", () => {
  const cam = shot3(320);
  for (const p of measurePills(cam, 1920, 1080)) assert.equal(p.offset, 0, `${p.id} on its line`);
});

test("pills fade out only when the line is too short to hold anything", () => {
  const far: Cam = { ...overview, zoom: 0.12, tilt: 0 };
  for (const p of measurePills(far, 1920, 1080)) assert.ok(p.fade < 1, `${p.id} fades at ${far.zoom}`);
  for (const p of measurePills({ ...far, zoom: 0.5 }, 1920, 1080)) assert.equal(p.fade, 1);
});

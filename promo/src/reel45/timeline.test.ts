import { test } from "node:test";
import assert from "node:assert/strict";
import { CUES } from "../timeline.ts";
import { CUES_45, DURATION_FRAMES, SCENES, SCENE_IDS, SHIFT, sceneAt } from "./timeline.ts";

test("scenes tile 0..3000 in order with no gaps", () => {
  let next = 0;
  SCENE_IDS.forEach((id, i) => {
    assert.equal(SCENES[id].from, next, id);
    assert.equal(SCENES[id].index, i + 1, id);
    next = SCENES[id].to;
  });
  assert.equal(next, DURATION_FRAMES);
  assert.equal(sceneAt(2999), "end");
});

test("reused shots keep their length; shots 5-7 sit SHIFT frames later", () => {
  assert.equal(SCENES.app.to, 480);
  assert.equal(SCENES.montage.from, 480 + SHIFT);
  assert.equal(SCENES.end.to - SCENES.end.from, 180);
});

test("every cue sounds inside the reel, and every showreel cue is kept", () => {
  for (const c of CUES_45) assert.ok(c.at >= 0 && c.at < DURATION_FRAMES, `${c.kind} at ${c.at}`);
  for (const c of CUES) assert.ok(CUES_45.some((d) => d.kind === c.kind && d.at === (c.at >= 480 ? c.at + SHIFT : c.at)), `${c.kind} at ${c.at}`);
});

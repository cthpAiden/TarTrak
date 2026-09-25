import { test } from "node:test";
import assert from "node:assert/strict";
import { beat, bar, CUES, DURATION_FRAMES, FRAMES_PER_BEAT, GLITCHES, glitchAt, SHOTS, shotAt, timecode } from "./timeline.ts";

test("beat grid: 30 frames per beat at 60 fps and 120 BPM", () => {
  assert.equal(FRAMES_PER_BEAT, 30);
  assert.equal(beat(1), 30);
  assert.equal(beat(0.25), 8); // 7.5 rounds to 8
  assert.equal(bar(2), 240);
});

test("shots tile the whole video on downbeats", () => {
  const list = Object.values(SHOTS).sort((a, b) => a.from - b.from);
  assert.equal(list[0].from, 0);
  assert.equal(list[list.length - 1].to, DURATION_FRAMES);
  for (let i = 1; i < list.length; i++) assert.equal(list[i].from, list[i - 1].to);
  for (const s of list) assert.equal(s.from % 120, 0);
});

test("shotAt finds the shot for a frame", () => {
  assert.equal(shotAt(0), "snap");
  assert.equal(shotAt(119), "snap");
  assert.equal(shotAt(120), "map");
  assert.equal(shotAt(899), "end");
});

test("cues are inside the video and sorted", () => {
  for (const c of CUES) {
    assert.ok(c.at >= 0 && c.at < DURATION_FRAMES, `${c.kind} at ${c.at}`);
  }
  for (let i = 1; i < CUES.length; i++) assert.ok(CUES[i].at >= CUES[i - 1].at);
});

test("glitch is strongest on the cut frame and zero away from cuts", () => {
  const cut = GLITCHES[0];
  assert.equal(glitchAt(cut), 1);
  assert.ok(glitchAt(cut + 1) < 1 && glitchAt(cut + 1) > 0);
  assert.equal(glitchAt(cut + 10), 0);
  assert.equal(glitchAt(5), 0);
});

test("timecode reads seconds and frames", () => {
  assert.equal(timecode(0), "00:00:00");
  assert.equal(timecode(61), "00:01:01");
  assert.equal(timecode(899), "00:14:59");
});

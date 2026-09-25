import { test } from "node:test";
import assert from "node:assert/strict";
import { scramble, typed } from "./text.ts";

test("scramble resolves fully at progress 1", () => {
  assert.equal(scramble("K7Q2XM", 1, 10), "K7Q2XM");
});

test("scramble keeps length and spaces, and is deterministic per frame", () => {
  const s = scramble("AB CD", 0, 3, 9);
  assert.equal(s.length, 5);
  assert.equal(s[2], " ");
  assert.equal(s, scramble("AB CD", 0, 3, 9));
});

test("scramble resolves left to right", () => {
  const s = scramble("ABCDEF", 0.5, 1);
  assert.equal(s.slice(0, 3), "ABC");
});

test("typed reveals a prefix", () => {
  assert.equal(typed("github", 0), "");
  assert.equal(typed("github", 0.5), "git");
  assert.equal(typed("github", 1), "github");
});

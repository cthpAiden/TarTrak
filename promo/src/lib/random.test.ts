import { test } from "node:test";
import assert from "node:assert/strict";
import { hash01, rng } from "./random.ts";

test("rng is deterministic and in [0, 1)", () => {
  const a = rng(42), b = rng(42);
  for (let i = 0; i < 100; i++) {
    const x = a();
    assert.equal(x, b());
    assert.ok(x >= 0 && x < 1);
  }
});

test("hash01 is stable per (seed, i) and differs across i", () => {
  assert.equal(hash01(7, 3), hash01(7, 3));
  assert.notEqual(hash01(7, 3), hash01(7, 4));
});

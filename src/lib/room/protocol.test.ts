import { describe, it, expect } from "vitest";
import {
  generateRoomCode,
  isValidRoomCode,
  parseClientMessage,
  parseServerMessage,
  MAX_MESSAGE_BYTES,
  MAX_DRAW_MESSAGE_BYTES,
  MAX_DRAW_POINTS,
} from "./protocol";

const pos = { type: "pos", name: "Bob", color: "#ff0000", map: "customs", x: 1.5, y: 2, z: -3, yaw: 90, ts: 1700000000000 };

describe("room codes", () => {
  it("accepts 6 uppercase alphanumerics only", () => {
    expect(isValidRoomCode("ABC123")).toBe(true);
    expect(isValidRoomCode("abc123")).toBe(false);
    expect(isValidRoomCode("ABC12")).toBe(false);
    expect(isValidRoomCode("ABC-12")).toBe(false);
  });

  it("generates valid codes from the injected RNG", () => {
    let i = 0;
    const seq = [0, 0.5, 0.999, 0.25, 0.75, 0.1];
    const code = generateRoomCode(() => seq[i++]);
    expect(isValidRoomCode(code)).toBe(true);
    expect(code).toHaveLength(6);
    expect(isValidRoomCode(generateRoomCode())).toBe(true);
  });
});

describe("parseClientMessage", () => {
  it("accepts a valid pos and hello", () => {
    expect(parseClientMessage(JSON.stringify(pos))).toEqual(pos);
    expect(parseClientMessage(JSON.stringify({ type: "hello", name: "A", color: "#fff" }))).toEqual({
      type: "hello",
      name: "A",
      color: "#fff",
    });
  });

  it("accepts a null map", () => {
    expect(parseClientMessage(JSON.stringify({ ...pos, map: null }))?.type).toBe("pos");
  });

  it("rejects malformed JSON, unknown types and leave from clients", () => {
    expect(parseClientMessage("{nope")).toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: "boom" }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: "leave", id: "x" }))).toBeNull();
    expect(parseClientMessage("null")).toBeNull();
    expect(parseClientMessage("[]")).toBeNull();
  });

  it("rejects non-finite numbers and wrong field types", () => {
    expect(parseClientMessage(JSON.stringify({ ...pos, x: "1" }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ ...pos, yaw: null }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ ...pos, name: 5 }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ ...pos, map: 7 }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ ...pos }).replace("1.5", "1e999"))).toBeNull();
  });

  it("rejects strings over 32 chars and messages of 512 bytes or more", () => {
    expect(parseClientMessage(JSON.stringify({ ...pos, name: "x".repeat(33) }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ ...pos, name: "x".repeat(32) }))).not.toBeNull();
    const big = JSON.stringify({ type: "hello", name: "a", color: "b", pad: "p".repeat(MAX_MESSAGE_BYTES) });
    expect(parseClientMessage(big)).toBeNull();
  });

  it("drops unknown extra fields", () => {
    const parsed = parseClientMessage(JSON.stringify({ ...pos, extra: 1 }));
    expect(parsed).toEqual(pos);
  });

  it("rejects an oversized map string and accepts one at the 32-char limit", () => {
    expect(parseClientMessage(JSON.stringify({ ...pos, map: "x".repeat(33) }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ ...pos, map: "x".repeat(32) }))).not.toBeNull();
  });

  it("accepts a message at exactly 511 bytes and rejects one at exactly 512 bytes", () => {
    const at511 = JSON.stringify({ type: "hello", name: "a", color: "b", pad: "p".repeat(463) });
    const at512 = JSON.stringify({ type: "hello", name: "a", color: "b", pad: "p".repeat(464) });
    expect(new TextEncoder().encode(at511).length).toBe(511);
    expect(new TextEncoder().encode(at512).length).toBe(512);
    expect(parseClientMessage(at511)).not.toBeNull();
    expect(parseClientMessage(at512)).toBeNull();
  });
});

describe("pins", () => {
  const pin = { type: "pin", pin: "abcd1234", map: "customs", x: 1.5, z: -2, label: "loot", color: "#f00" };

  it("accepts pin and unpin from clients and with an id from the relay", () => {
    expect(parseClientMessage(JSON.stringify(pin))).toEqual(pin);
    expect(parseClientMessage(JSON.stringify({ ...pin, label: "" }))).toEqual({ ...pin, label: "" });
    expect(parseClientMessage(JSON.stringify({ type: "unpin", pin: "abcd1234" }))).toEqual({ type: "unpin", pin: "abcd1234" });
    expect(parseServerMessage(JSON.stringify({ ...pin, id: "s1" }))).toEqual({ ...pin, id: "s1" });
    expect(parseServerMessage(JSON.stringify({ type: "unpin", pin: "abcd1234", id: "s1" }))).toEqual({ type: "unpin", pin: "abcd1234", id: "s1" });
  });

  it("rejects an empty or missing pin id, an empty map, a long label and bad coordinates", () => {
    expect(parseClientMessage(JSON.stringify({ ...pin, pin: "" }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: "unpin" }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ ...pin, map: "" }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ ...pin, label: "x".repeat(33) }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ ...pin, x: "1" }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ ...pin, z: Infinity }))).toBeNull();
  });
});

describe("parseServerMessage", () => {
  it("accepts pos/hello with id and leave", () => {
    expect(parseServerMessage(JSON.stringify({ ...pos, id: "abc" }))).toEqual({ ...pos, id: "abc" });
    expect(parseServerMessage(JSON.stringify({ type: "leave", id: "abc" }))).toEqual({ type: "leave", id: "abc" });
    expect(parseServerMessage(JSON.stringify({ type: "hello", id: "q", name: "N", color: "#000" }))).toEqual({
      type: "hello",
      id: "q",
      name: "N",
      color: "#000",
    });
  });

  it("rejects messages without an id", () => {
    expect(parseServerMessage(JSON.stringify(pos))).toBeNull();
    expect(parseServerMessage(JSON.stringify({ type: "leave" }))).toBeNull();
  });

  it("enforces id bounds: rejects empty and over-32-char ids, accepts a relay-sized 8-char id", () => {
    expect(parseServerMessage(JSON.stringify({ type: "leave", id: "" }))).toBeNull();
    expect(parseServerMessage(JSON.stringify({ type: "leave", id: "x".repeat(33) }))).toBeNull();
    expect(parseServerMessage(JSON.stringify({ type: "leave", id: "x".repeat(8) }))).toEqual({
      type: "leave",
      id: "x".repeat(8),
    });
  });
});

describe("drawing messages", () => {
  const points = Array.from({ length: MAX_DRAW_POINTS }, (_, i) => [i * 1.5, -(i + 1) * 2.5]);
  const draw = { type: "draw", draw: "abcd1234", map: "customs", color: "#0f0", points };

  it("accepts a full-length stroke even though it is far over the small message cap", () => {
    const raw = JSON.stringify(draw);
    expect(new TextEncoder().encode(raw).length).toBeGreaterThan(MAX_MESSAGE_BYTES);
    expect(new TextEncoder().encode(raw).length).toBeLessThan(MAX_DRAW_MESSAGE_BYTES);
    expect(parseClientMessage(raw)).toEqual(draw);
    expect(parseServerMessage(JSON.stringify({ ...draw, id: "r1" }))).toEqual({ ...draw, id: "r1" });
  });

  it("keeps the small cap for every other message type", () => {
    const big = JSON.stringify({ type: "hello", name: "a", color: "b", pad: "p".repeat(MAX_MESSAGE_BYTES) });
    expect(parseClientMessage(big)).toBeNull();
    const huge = JSON.stringify({ ...draw, pad: "p".repeat(MAX_DRAW_MESSAGE_BYTES) });
    expect(parseClientMessage(huge)).toBeNull();
  });

  it("rejects strokes with too few or too many points, or a bad point", () => {
    expect(parseClientMessage(JSON.stringify({ ...draw, points: [[1, 2]] }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ ...draw, points: [...points, [1, 1]] }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ ...draw, points: [[1, 2], [3]] }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ ...draw, points: [[1, 2], ["3", 4]] }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ ...draw, map: "" }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ ...draw, draw: "" }))).toBeNull();
  });

  it("parses undraw and cleardraw, requiring their ids", () => {
    expect(parseClientMessage(JSON.stringify({ type: "undraw", draw: "abcd1234" }))).toEqual({ type: "undraw", draw: "abcd1234" });
    expect(parseClientMessage(JSON.stringify({ type: "undraw", draw: "" }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: "cleardraw", map: "customs" }))).toEqual({ type: "cleardraw", map: "customs" });
    expect(parseClientMessage(JSON.stringify({ type: "cleardraw" }))).toBeNull();
    expect(parseServerMessage(JSON.stringify({ type: "cleardraw", map: "customs", id: "r1" }))).toEqual({ type: "cleardraw", map: "customs", id: "r1" });
  });
});

import { describe, it, expect } from "vitest";
import {
  generateRoomCode,
  isValidRoomCode,
  parseClientMessage,
  parseServerMessage,
  MAX_MESSAGE_BYTES,
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
});

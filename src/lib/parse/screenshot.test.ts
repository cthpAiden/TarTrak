import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseScreenshotName, yawFromQuaternion } from "./screenshot";

const fixtures = readFileSync("tests/fixtures/screenshot-filenames.txt", "utf8")
  .split(/\r?\n/)
  .filter((l) => l.length > 0);

describe("parseScreenshotName", () => {
  it("parses a real in-raid filename", () => {
    const p = parseScreenshotName(
      "2026-09-04[04-56]_-230.88, 3.59, -375.83_-0.02798, -0.17807, 0.00669, -0.98360_0.64 (0).png",
    );
    expect(p).not.toBeNull();
    expect(p!.x).toBeCloseTo(-230.88, 5);
    expect(p!.y).toBeCloseTo(3.59, 5);
    expect(p!.z).toBeCloseTo(-375.83, 5);
    expect(p!.yaw).toBeGreaterThanOrEqual(0);
    expect(p!.yaw).toBeLessThan(360);
  });

  it("parses without the trailing float", () => {
    const p = parseScreenshotName("2024-05-04[22-01]_-114.6, 1.1, -98.2_0.0, 0.9, 0.0, -0.4 (0).png");
    expect(p).not.toBeNull();
    expect(p!.x).toBeCloseTo(-114.6, 5);
  });

  it("parses without the (N) counter and with seconds in the time block", () => {
    const p = parseScreenshotName("2024-05-04[22-01-33]_1, 2, 3_0, 0, 0, 1_5.5.PNG");
    expect(p).not.toBeNull();
    expect(p!.z).toBe(3);
  });

  it("returns null for a menu screenshot", () => {
    expect(parseScreenshotName("2026-09-04[01-12]_7.92 (0).png")).toBeNull();
  });

  it("returns null for garbage", () => {
    expect(parseScreenshotName("hello.png")).toBeNull();
    expect(parseScreenshotName("")).toBeNull();
    expect(parseScreenshotName("2026-09-04[04-56]_a, b, c_0, 0, 0, 1 (0).png")).toBeNull();
  });

  it("parses every real in-raid fixture and rejects the menu one", () => {
    const parsed = fixtures.map((f) => [f, parseScreenshotName(f)] as const);
    const inRaid = parsed.filter(([f]) => f.split("_").length >= 4);
    const menu = parsed.filter(([f]) => f.split("_").length < 4);
    expect(inRaid.length).toBeGreaterThan(50);
    expect(menu.length).toBeGreaterThan(0);
    for (const [, p] of inRaid) expect(p).not.toBeNull();
    for (const [, p] of menu) expect(p).toBeNull();
  });
});

describe("yawFromQuaternion", () => {
  const half = (deg: number) => (deg * Math.PI) / 360;
  const pureY = (deg: number) => [0, Math.sin(half(deg)), 0, Math.cos(half(deg))] as const;

  it.each([0, 90, 180, 270, 45, 359])("pure y-rotation of %i degrees", (deg) => {
    const [rx, ry, rz, rw] = pureY(deg);
    expect(yawFromQuaternion(rx, ry, rz, rw)).toBeCloseTo(deg, 4);
  });

  it("normalizes negative angles into [0, 360)", () => {
    const [rx, ry, rz, rw] = pureY(-90);
    expect(yawFromQuaternion(rx, ry, rz, rw)).toBeCloseTo(270, 4);
  });

  it("ignores pitch for a pitched camera looking north", () => {
    // 30 degrees pitch around x, no yaw
    const [rx, rw] = [Math.sin(half(30)), Math.cos(half(30))];
    expect(yawFromQuaternion(rx, 0, 0, rw)).toBeCloseTo(0, 4);
  });
});

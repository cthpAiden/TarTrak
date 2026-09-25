import { describe, it, expect } from "vitest";
import { makeCrs, toLatLng, boundsOf, screenBearing } from "./crs";
import { getMapDef } from "./mapsData";

describe("makeCrs", () => {
  it("maps the game origin to the transform margins", () => {
    const def = getMapDef("customs")!; // transform [0.239, 168.65, 0.239, 136.35], rotation 180
    const crs = makeCrs(def);
    const p = crs.latLngToPoint(toLatLng(0, 0), 0);
    expect(p.x).toBeCloseTo(168.65, 5);
    expect(p.y).toBeCloseTo(136.35, 5);
  });

  it("applies scale and 180 degree rotation", () => {
    const def = getMapDef("customs")!;
    const crs = makeCrs(def);
    const p = crs.latLngToPoint(toLatLng(100, 0), 0);
    expect(p.x).toBeCloseTo(0.239 * -100 + 168.65, 5);
    expect(p.y).toBeCloseTo(136.35, 5);
  });

  it("negates the y axis (customs, z offset)", () => {
    const def = getMapDef("customs")!;
    const crs = makeCrs(def);
    const p = crs.latLngToPoint(toLatLng(0, 100), 0);
    expect(p.x).toBeCloseTo(168.65, 5);
    expect(p.y).toBeCloseTo(-0.239 * -100 + 136.35, 5);
  });

  it("applies rotation direction (factory, 90 degrees)", () => {
    const def = getMapDef("factory")!;
    const crs = makeCrs(def);
    const p = crs.latLngToPoint(toLatLng(10, 20), 0);
    expect(p.x).toBeCloseTo(1.629 * -20 + 119.9, 2);
    expect(p.y).toBeCloseTo(-1.629 * 10 + 139.3, 2);
  });

  it("round-trips through pointToLatLng", () => {
    const def = getMapDef("factory")!; // rotation 90
    const crs = makeCrs(def);
    const ll = toLatLng(12.5, -30.25);
    const back = crs.pointToLatLng(crs.latLngToPoint(ll, 3), 3);
    expect(back.lat).toBeCloseTo(ll.lat, 6);
    expect(back.lng).toBeCloseTo(ll.lng, 6);
  });

  it("boundsOf swaps to [z, x] order", () => {
    const def = getMapDef("lighthouse")!; // bounds [[515,-998],[-545,725]]
    const b = boundsOf(def);
    expect(b.getSouthWest().lat).toBe(-998);
    expect(b.getSouthWest().lng).toBe(-545);
    expect(b.getNorthEast().lat).toBe(725);
    expect(b.getNorthEast().lng).toBe(515);
  });
});

describe("screenBearing", () => {
  const norm = (d: number) => Math.round(((d % 360) + 360) % 360);

  it("keeps the heading on a map drawn with +z up", () => {
    const def = { ...getMapDef("customs")!, coordinateRotation: 0 };
    expect(norm(screenBearing(def, 0))).toBe(0);
    expect(norm(screenBearing(def, 90))).toBe(90);
  });

  it("turns it round on a map rotated 180 degrees (customs): facing +z points down the screen", () => {
    const def = getMapDef("customs")!;
    expect(norm(screenBearing(def, 0))).toBe(180);
    expect(norm(screenBearing(def, 90))).toBe(270);
  });

  it("follows the map's own rotation (factory, 90 degrees)", () => {
    const def = getMapDef("factory")!;
    const crs = makeCrs(def);
    const a = crs.latLngToPoint(toLatLng(0, 0), 0);
    const b = crs.latLngToPoint(toLatLng(0, 1), 0);
    const expected = (Math.atan2(b.x - a.x, a.y - b.y) * 180) / Math.PI;
    expect(norm(screenBearing(def, 0))).toBe(norm(expected));
  });
});

import { describe, it, expect } from "vitest";
import { makeCrs, toLatLng, boundsOf } from "./crs";
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

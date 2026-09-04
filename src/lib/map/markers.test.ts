import { describe, it, expect, beforeEach } from "vitest";
import L from "leaflet";
import { PositionMarker } from "./markers";
import { makeCrs, boundsOf, toLatLng } from "./crs";
import { getMapDef } from "./mapsData";

function makeMap(): L.Map {
  const el = document.createElement("div");
  Object.defineProperty(el, "clientWidth", { value: 800 });
  Object.defineProperty(el, "clientHeight", { value: 600 });
  document.body.appendChild(el);
  const def = getMapDef("customs")!;
  const map = L.map(el, { crs: makeCrs(def), zoomAnimation: false, fadeAnimation: false, markerZoomAnimation: false });
  map.fitBounds(boundsOf(def), { animate: false });
  return map;
}

/** Unrounded pixel position of a game point, unlike latLngToLayerPoint. */
function px(map: L.Map, x: number, z: number): L.Point {
  return map.project(toLatLng(x, z), map.getZoom());
}

/** Where the CRS puts one game unit of heading, as a unit vector in pixel space. */
function headingUnit(map: L.Map, x: number, z: number, yaw: number): L.Point {
  const rad = (yaw * Math.PI) / 180;
  const d = px(map, x + Math.sin(rad), z + Math.cos(rad)).subtract(px(map, x, z));
  return d.divideBy(Math.hypot(d.x, d.y));
}

describe("PositionMarker", () => {
  let map: L.Map;
  beforeEach(() => {
    map = makeMap();
  });

  it("draws a heading line of the configured pixel length", () => {
    const m = new PositionMarker(map, { color: "#f0b429", radius: 6, lineLengthPx: 28 });
    m.update(100, -50, 90);
    const [a, b] = m.linePoints();
    const pa = map.project(a, map.getZoom());
    const pb = map.project(b, map.getZoom());
    expect(pa.distanceTo(pb)).toBeCloseTo(28, 3);
    expect(m.center().lng).toBe(100);
    expect(m.center().lat).toBe(-50);
  });

  it("puts the line end 28 px along the CRS heading direction", () => {
    const m = new PositionMarker(map, { color: "#fff", radius: 6, lineLengthPx: 28 });
    for (const yaw of [0, 90, 217]) {
      m.update(100, -50, yaw);
      const start = px(map, 100, -50);
      const want = start.add(headingUnit(map, 100, -50, yaw).multiplyBy(28));
      const got = map.project(m.linePoints()[1], map.getZoom());
      expect(got.x).toBeCloseTo(want.x, 3);
      expect(got.y).toBeCloseTo(want.y, 3);
    }
  });

  it("orients yaw 0 and yaw 90 along the axes customs' 180 degree rotation implies", () => {
    const m = new PositionMarker(map, { color: "#fff", radius: 6, lineLengthPx: 28 });
    const start = px(map, 0, 0);

    m.update(0, 0, 0);
    const north = map.project(m.linePoints()[1], map.getZoom());
    expect(north.x - start.x).toBeCloseTo(0, 3);
    expect(north.y - start.y).toBeCloseTo(28, 3);

    m.update(0, 0, 90);
    const east = map.project(m.linePoints()[1], map.getZoom());
    expect(east.x - start.x).toBeCloseTo(-28, 3);
    expect(east.y - start.y).toBeCloseTo(0, 3);
  });

  it("points different directions for different yaws", () => {
    const m = new PositionMarker(map, { color: "#fff", radius: 6, lineLengthPx: 28 });
    m.update(0, 0, 0);
    const north = map.project(m.linePoints()[1], map.getZoom());
    m.update(0, 0, 90);
    const east = map.project(m.linePoints()[1], map.getZoom());
    expect(north.distanceTo(east)).toBeGreaterThan(20);
  });

  it("applies opacity to circle and line and removes both", () => {
    const m = new PositionMarker(map, { color: "#fff", radius: 6, lineLengthPx: 28, label: "Bob" });
    m.update(0, 0, 0);
    m.setOpacity(0.35);
    expect(m.circle.options.opacity).toBeCloseTo(0.35);
    expect(m.circle.options.fillOpacity).toBeCloseTo(0.35);
    expect(m.line.options.opacity).toBeCloseTo(0.35);
    expect(map.hasLayer(m.circle)).toBe(true);
    m.remove();
    expect(map.hasLayer(m.circle)).toBe(false);
    expect(map.hasLayer(m.line)).toBe(false);
  });
});

import { describe, it, expect, beforeEach } from "vitest";
import L from "leaflet";
import { PositionMarker } from "./markers";
import { makeCrs, boundsOf } from "./crs";
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

describe("PositionMarker", () => {
  let map: L.Map;
  beforeEach(() => {
    map = makeMap();
  });

  it("draws a heading line of the configured pixel length", () => {
    const m = new PositionMarker(map, { color: "#f0b429", radius: 6, lineLengthPx: 28 });
    m.update(100, -50, 90);
    const [a, b] = m.linePoints();
    const pa = map.latLngToLayerPoint(a);
    const pb = map.latLngToLayerPoint(b);
    expect(pa.distanceTo(pb)).toBeCloseTo(28, 3);
    expect(m.center().lng).toBe(100);
    expect(m.center().lat).toBe(-50);
  });

  it("points different directions for different yaws", () => {
    const m = new PositionMarker(map, { color: "#fff", radius: 6, lineLengthPx: 28 });
    m.update(0, 0, 0);
    const north = map.latLngToLayerPoint(m.linePoints()[1]);
    m.update(0, 0, 90);
    const east = map.latLngToLayerPoint(m.linePoints()[1]);
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

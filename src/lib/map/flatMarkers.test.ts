import { describe, it, expect, beforeAll } from "vitest";
import L from "leaflet";
import { installFlatMarkers } from "./flatMarkers";
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

/** "translate(12px, 34px)" -> [12, 34]; null for anything else, including translate3d. */
function translate2d(el: HTMLElement): [number, number] | null {
  const m = /^translate\((-?\d+)px,\s*(-?\d+)px\)$/.exec(el.style.transform);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

describe("installFlatMarkers", () => {
  beforeAll(() => {
    installFlatMarkers();
    // A second call must not stack a second override or throw.
    installFlatMarkers();
  });

  it("positions a marker with a 2D translate at the same integer layer point Leaflet would use", () => {
    const map = makeMap();
    const m = L.marker(toLatLng(100, -50)).addTo(map);
    const el = m.getElement()!;
    const want = map.latLngToLayerPoint(toLatLng(100, -50)).round();
    expect(translate2d(el)).toEqual([want.x, want.y]);
    expect(el.style.transform).not.toContain("3d");
    m.remove();
  });

  it("keeps Leaflet's own position bookkeeping and the y-based z-index", () => {
    const map = makeMap();
    const m = L.marker(toLatLng(100, -50), { zIndexOffset: 7 }).addTo(map);
    const el = m.getElement()!;
    const want = map.latLngToLayerPoint(toLatLng(100, -50)).round();
    expect(L.DomUtil.getPosition(el)).toEqual(want);
    expect(el.style.zIndex).toBe(String(want.y + 7));
    m.remove();
  });

  it("follows the marker when it moves", () => {
    const map = makeMap();
    const m = L.marker(toLatLng(0, 0)).addTo(map);
    m.setLatLng(toLatLng(30, 40));
    const want = map.latLngToLayerPoint(toLatLng(30, 40)).round();
    expect(translate2d(m.getElement()!)).toEqual([want.x, want.y]);
    m.remove();
  });

  it("leaves the map pane on Leaflet's own positioning so panning stays as it was", () => {
    const map = makeMap();
    map.panBy([10, 10], { animate: false });
    // jsdom has no 3D support, so Leaflet falls back to left/top there; either way, not a 2D translate.
    const pane = map.getPane("mapPane")!;
    expect(translate2d(pane)).toBeNull();
  });
});

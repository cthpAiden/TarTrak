import { describe, it, expect, beforeEach } from "vitest";
import L from "leaflet";
import { ReplayLayer, type ReplayTrail } from "./replayLayer";
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

const trail = (key: string, mine: boolean, times: number[]): ReplayTrail => ({
  key,
  name: key,
  color: mine ? "#f0b429" : "#5aa9e6",
  mine,
  points: times.map((t) => ({ t, x: t / 1000, y: 0, z: 0, yaw: 0 })),
});

const lines = (map: L.Map) => {
  const out: L.Polyline[] = [];
  map.eachLayer((l) => {
    if (l instanceof L.Polyline && l.options.pane === "replay") out.push(l);
  });
  return out;
};

describe("ReplayLayer", () => {
  let map: L.Map;
  beforeEach(() => {
    map = makeMap();
  });

  it("draws a faint and a bright line per trail, cut at the playhead", () => {
    const layer = new ReplayLayer(map, 100);
    layer.update([trail("me", true, [0, 100_000, 200_000, 400_000])], 300_000);
    const [old, tail] = lines(map);
    expect(old.options.opacity).toBeLessThan(1);
    // 0 and 100 s are older than the 3 min tail; the faint line runs on to 200 s, where the bright one starts.
    expect((old.getLatLngs() as L.LatLng[]).length).toBe(3);
    expect((tail.getLatLngs() as L.LatLng[]).length).toBe(1);
  });

  it("adds a marker for a teammate once their first position is reached, and drops trails that go", () => {
    const layer = new ReplayLayer(map, 100);
    const mate = trail("Rook", false, [50_000]);
    layer.update([trail("me", true, [0]), mate], 10_000);
    const before = document.querySelectorAll(".tt-age").length;
    layer.update([trail("me", true, [0]), mate], 60_000);
    expect(document.querySelectorAll(".tt-age").length).toBe(before + 1);
    layer.update([trail("me", true, [0])], 60_000);
    expect(lines(map)).toHaveLength(2);
    layer.remove();
    expect(lines(map)).toHaveLength(0);
  });
});

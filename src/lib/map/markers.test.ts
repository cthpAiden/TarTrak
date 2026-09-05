import { describe, it, expect, beforeEach } from "vitest";
import L from "leaflet";
import { OWN_PANE, PLAYER_PANE, PositionMarker } from "./markers";
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

describe("PositionMarker label", () => {
  it("escapes HTML in the name so a teammate cannot inject markup", () => {
    const map = makeMap();
    const m = new PositionMarker(map, { color: "#fff", radius: 6, lineLengthPx: 28, label: "<b>x</b>" });
    m.update(0, 0, 0);
    const tt = m.circle.getTooltip()!;
    expect(tt.getContent()).toBe("&#60;b&#62;x&#60;/b&#62;");
    m.remove();
  });
});

describe("PositionMarker view cone", () => {
  let map: L.Map;
  beforeEach(() => {
    map = makeMap();
  });

  function conePoints(m: PositionMarker): L.LatLng[] {
    return (m.cone!.getLatLngs() as L.LatLng[][])[0];
  }

  it("draws no polygon when the cone is off", () => {
    const m = new PositionMarker(map, { color: "#fff", radius: 6, lineLengthPx: 28 });
    m.update(0, 0, 0);
    expect(m.cone).toBeNull();
  });

  it("draws a sector of the centre plus nine arc points", () => {
    const m = new PositionMarker(map, { color: "#fff", radius: 6, lineLengthPx: 28, cone: true });
    m.update(100, -50, 90);
    const pts = conePoints(m);
    expect(pts).toHaveLength(10);
    expect(pts[0].lng).toBeCloseTo(100, 6);
    expect(pts[0].lat).toBeCloseTo(-50, 6);
    const start = px(map, 100, -50);
    for (const p of pts.slice(1)) {
      expect(map.project(p, map.getZoom()).distanceTo(start)).toBeCloseTo(28 * 1.6, 3);
    }
  });

  it("spans coneDeg around the heading, with the middle arc point on the heading", () => {
    const m = new PositionMarker(map, { color: "#fff", radius: 6, lineLengthPx: 28, cone: true, coneDeg: 60 });
    m.update(100, -50, 90);
    const start = px(map, 100, -50);
    const arc = conePoints(m)
      .slice(1)
      .map((p) => map.project(p, map.getZoom()).subtract(start));
    const angle = (p: L.Point) => (Math.atan2(p.y, p.x) * 180) / Math.PI;
    const spread = Math.abs(angle(arc[8]) - angle(arc[0]));
    expect(Math.min(spread, 360 - spread)).toBeCloseTo(60, 3);
    const want = headingUnit(map, 100, -50, 90).multiplyBy(28 * 1.6);
    expect(arc[4].x).toBeCloseTo(want.x, 3);
    expect(arc[4].y).toBeCloseTo(want.y, 3);
  });

  it("honours a custom cone width", () => {
    const m = new PositionMarker(map, { color: "#fff", radius: 6, lineLengthPx: 28, cone: true, coneDeg: 120 });
    m.update(0, 0, 0);
    const start = px(map, 0, 0);
    const arc = conePoints(m)
      .slice(1)
      .map((p) => map.project(p, map.getZoom()).subtract(start));
    const angle = (p: L.Point) => (Math.atan2(p.y, p.x) * 180) / Math.PI;
    const spread = Math.abs(angle(arc[8]) - angle(arc[0]));
    expect(Math.min(spread, 360 - spread)).toBeCloseTo(120, 3);
  });

  it("fades, recolours and removes the cone with the rest of the marker", () => {
    const m = new PositionMarker(map, { color: "#fff", radius: 6, lineLengthPx: 28, cone: true });
    m.update(0, 0, 0);
    expect(m.cone!.options.fillOpacity).toBeCloseTo(0.18);
    expect(m.cone!.options.stroke).toBe(false);
    m.setOpacity(0.5);
    expect(m.cone!.options.fillOpacity).toBeCloseTo(0.09);
    m.setColor("#123456");
    expect(m.cone!.options.fillColor).toBe("#123456");
    expect(map.hasLayer(m.cone!)).toBe(true);
    m.remove();
    expect(map.hasLayer(m.cone!)).toBe(false);
  });
});

describe("player pane", () => {
  it("draws every part in a pane above the marker pane", () => {
    const map = makeMap();
    const m = new PositionMarker(map, { color: "#fff", radius: 6, lineLengthPx: 28, cone: true });
    const pane = map.getPane(PLAYER_PANE)!;
    expect(Number(pane.style.zIndex)).toBeGreaterThan(600);
    expect(m.circle.options.pane).toBe(PLAYER_PANE);
    expect(m.line.options.pane).toBe(PLAYER_PANE);
    expect(m.cone!.options.pane).toBe(PLAYER_PANE);
    // Adding a second marker to the same map must reuse the pane, not throw on a duplicate.
    new PositionMarker(map, { color: "#fff", radius: 6, lineLengthPx: 28 });
  });

  it("keeps a teammate's name label in the players pane, below the own pane", () => {
    const map = makeMap();
    const mate = new PositionMarker(map, { color: "#0f0", radius: 6, lineLengthPx: 28, label: "Bob" });
    const me = new PositionMarker(map, { color: "#fff", radius: 6, lineLengthPx: 28, cone: true, pane: OWN_PANE });
    mate.update(0, 0, 0);
    me.update(0, 0, 0);
    const players = Number(map.getPane(PLAYER_PANE)!.style.zIndex);
    const ownZ = Number(map.getPane(OWN_PANE)!.style.zIndex);
    expect(ownZ).toBeGreaterThan(players);
    expect(mate.circle.getTooltip()!.options.pane).toBe(PLAYER_PANE);
    // The tooltip pane (650) would otherwise sit above every player.
    expect(ownZ).toBeLessThan(650);
    expect(mate.circle.getTooltip()!.getElement()?.parentElement).toBe(map.getPane(PLAYER_PANE));
    expect(me.circle.options.pane).toBe(OWN_PANE);
    expect(me.line.options.pane).toBe(OWN_PANE);
    expect(me.cone!.options.pane).toBe(OWN_PANE);
  });
});

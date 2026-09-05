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

/** Pixels per game unit along a heading at the current zoom. */
function metrePx(map: L.Map, x: number, z: number, yaw: number): number {
  const rad = (yaw * Math.PI) / 180;
  const d = px(map, x + Math.sin(rad), z + Math.cos(rad)).subtract(px(map, x, z));
  return Math.hypot(d.x, d.y);
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

  it("draws a dotted heading line of the configured length in metres, in game units", () => {
    const m = new PositionMarker(map, { color: "#f0b429", radius: 6, lineLengthM: 28 });
    m.update(100, -50, 90);
    const [, b] = m.linePoints();
    // yaw 90: forward is +x, so the end sits 28 game units along x.
    expect(b.lng).toBeCloseTo(128, 6);
    expect(b.lat).toBeCloseTo(-50, 6);
    expect(m.center().lng).toBe(100);
    expect(m.center().lat).toBe(-50);
    expect(m.line.options.dashArray).toBe("2 10");
    expect(m.line.options.weight).toBe(3);
  });

  it("puts the line end 28 m along the CRS heading direction", () => {
    const m = new PositionMarker(map, { color: "#fff", radius: 6, lineLengthM: 28 });
    for (const yaw of [0, 90, 217]) {
      m.update(100, -50, yaw);
      const start = px(map, 100, -50);
      const want = start.add(headingUnit(map, 100, -50, yaw).multiplyBy(metrePx(map, 100, -50, yaw) * 28));
      const got = map.project(m.linePoints()[1], map.getZoom());
      expect(got.x).toBeCloseTo(want.x, 3);
      expect(got.y).toBeCloseTo(want.y, 3);
    }
  });

  it("orients yaw 0 and yaw 90 along the axes customs' 180 degree rotation implies", () => {
    const m = new PositionMarker(map, { color: "#fff", radius: 6, lineLengthM: 28 });
    const start = px(map, 0, 0);

    m.update(0, 0, 0);
    const north = map.project(m.linePoints()[1], map.getZoom());
    expect(north.x - start.x).toBeCloseTo(0, 3);
    expect(north.y - start.y).toBeGreaterThan(0);

    m.update(0, 0, 90);
    const east = map.project(m.linePoints()[1], map.getZoom());
    expect(east.x - start.x).toBeLessThan(0);
    expect(east.y - start.y).toBeCloseTo(0, 3);
  });

  it("points different directions for different yaws", () => {
    const m = new PositionMarker(map, { color: "#fff", radius: 6, lineLengthM: 28 });
    m.update(0, 0, 0);
    const north = map.project(m.linePoints()[1], map.getZoom());
    m.update(0, 0, 90);
    const east = map.project(m.linePoints()[1], map.getZoom());
    expect(north.distanceTo(east)).toBeGreaterThan(0);
  });

  it("fades the line out along its length with a gradient that follows the line and the colour", () => {
    const m = new PositionMarker(map, { color: "#f0b429", radius: 6, lineLengthM: 28 });
    m.update(100, -50, 90);
    const path = (m.line as unknown as { _path: SVGPathElement })._path;
    expect(path.getAttribute("stroke")).toBe(`url(#${m.gradient.id})`);
    expect(m.gradient.getAttribute("gradientUnits")).toBe("userSpaceOnUse");
    const stops = Array.from(m.gradient.children);
    expect(stops.map((st) => [st.getAttribute("offset"), st.getAttribute("stop-opacity"), st.getAttribute("stop-color")])).toEqual([
      ["0", "1", "#f0b429"],
      ["1", "0", "#f0b429"],
    ]);
    const [a, b] = m.linePoints().map((p) => map.latLngToLayerPoint(p));
    expect(Number(m.gradient.getAttribute("x1"))).toBeCloseTo(a.x, 6);
    expect(Number(m.gradient.getAttribute("y1"))).toBeCloseTo(a.y, 6);
    expect(Number(m.gradient.getAttribute("x2"))).toBeCloseTo(b.x, 6);
    expect(Number(m.gradient.getAttribute("y2"))).toBeCloseTo(b.y, 6);
    expect(map.getContainer().contains(m.gradient)).toBe(true);

    m.setColor("#00ff00");
    expect(path.getAttribute("stroke")).toBe(`url(#${m.gradient.id})`);
    expect(stops.every((st) => st.getAttribute("stop-color") === "#00ff00")).toBe(true);
    m.setOpacity(0.5);
    expect(path.getAttribute("stroke")).toBe(`url(#${m.gradient.id})`);
    m.remove();
    expect(map.getContainer().contains(m.gradient)).toBe(false);
  });

  it("applies opacity to circle and line and removes both", () => {
    const m = new PositionMarker(map, { color: "#fff", radius: 6, lineLengthM: 28, label: "Bob" });
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
    const m = new PositionMarker(map, { color: "#fff", radius: 6, lineLengthM: 28, label: "<b>x</b>" });
    m.update(0, 0, 0);
    const tt = m.circle.getTooltip()!;
    expect(tt.getContent()).toBe("&#60;b&#62;x&#60;/b&#62;");
    m.remove();
  });

  it("setLabel swaps the text, escaped, and leaves a label-less marker alone", () => {
    const map = makeMap();
    const m = new PositionMarker(map, { color: "#fff", radius: 6, lineLengthM: 28, label: "Bob" });
    m.setLabel("Bob [2F] <i>");
    expect(m.circle.getTooltip()!.getContent()).toBe("Bob [2F] &#60;i&#62;");
    const plain = new PositionMarker(map, { color: "#fff", radius: 6, lineLengthM: 28 });
    plain.setLabel("x");
    expect(plain.circle.getTooltip()).toBeUndefined();
    m.remove();
    plain.remove();
  });
});

describe("player pane", () => {
  it("draws every part in a pane above the marker pane", () => {
    const map = makeMap();
    const m = new PositionMarker(map, { color: "#fff", radius: 6, lineLengthM: 28 });
    const pane = map.getPane(PLAYER_PANE)!;
    expect(Number(pane.style.zIndex)).toBeGreaterThan(600);
    expect(m.circle.options.pane).toBe(PLAYER_PANE);
    expect(m.line.options.pane).toBe(PLAYER_PANE);
    // Adding a second marker to the same map must reuse the pane, not throw on a duplicate.
    new PositionMarker(map, { color: "#fff", radius: 6, lineLengthM: 28 });
  });

  it("keeps a teammate's name label in the players pane, below the own pane", () => {
    const map = makeMap();
    const mate = new PositionMarker(map, { color: "#0f0", radius: 6, lineLengthM: 28, label: "Bob" });
    const me = new PositionMarker(map, { color: "#fff", radius: 6, lineLengthM: 28, pane: OWN_PANE });
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
  });
});

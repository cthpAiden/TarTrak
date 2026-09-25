import { describe, it, expect } from "vitest";
import L from "leaflet";
import { ADD_BATCH, PointMarkers, VIEW_PAD, type Defer } from "./pointMarkers";
import type { MapPoint } from "./points";
import { makeCrs, boundsOf, toLatLng } from "../map/crs";
import { getMapDef } from "../map/mapsData";
import { upright } from "../map/labels";

function makeMap(): L.Map {
  const el = document.createElement("div");
  Object.defineProperty(el, "clientWidth", { value: 800 });
  Object.defineProperty(el, "clientHeight", { value: 600 });
  document.body.appendChild(el);
  const def = getMapDef("customs")!;
  const map = L.map(el, { crs: makeCrs(def), zoomAnimation: false, fadeAnimation: false, markerZoomAnimation: false });
  map.fitBounds(boundsOf(def), { animate: false });
  // MapView's pane for zone footprints; outlines are drawn into it.
  map.createPane("zones");
  return map;
}

const pt = (id: string, x: number, z: number, over: Partial<MapPoint> = {}): MapPoint => ({
  id,
  group: "loot",
  category: "safe",
  name: `Safe ${id}`,
  mapKey: "customs",
  x,
  y: 0,
  z,
  details: ["Container"],
  ...over,
});

/** Game-coordinate box [x0, z0] to [x1, z1]. */
const box = (x0: number, z0: number, x1: number, z1: number) => L.latLngBounds(toLatLng(x0, z0), toLatLng(x1, z1));
const EVERYWHERE = box(-100000, -100000, 100000, 100000);

/** Synchronous by default; `manual` collects the steps so a test can run them one at a time. */
function setup(manual = false) {
  const map = makeMap();
  const group = L.layerGroup().addTo(map);
  const steps: (() => void)[] = [];
  const defer: Defer = manual ? (step) => steps.push(step) : (step) => step();
  const pm = new PointMarkers(map, group, defer);
  return { map, group, pm, steps };
}

describe("PointMarkers", () => {
  it("adds only the points inside the given bounds and drops the ones that leave", () => {
    const { pm } = setup();
    pm.setPoints([pt("a", 0, 0), pt("b", 500, 500)], new Set());
    pm.refresh(box(-10, -10, 10, 10));
    expect(pm.shownIds()).toEqual(["a"]);
    pm.refresh(box(490, 490, 510, 510));
    expect(pm.shownIds()).toEqual(["b"]);
    pm.refresh(EVERYWHERE);
    expect(pm.shownIds()).toEqual(["a", "b"]);
  });

  it("pads the map view by one viewport on each side when no bounds are given", () => {
    const { pm, map } = setup();
    // The view is the whole of Customs; a point three viewports away is out, one at the edge is in.
    const view = map.getBounds();
    const farX = view.getEast() + (view.getEast() - view.getWest()) * 3;
    const edgeX = view.getEast() + (view.getEast() - view.getWest()) * 0.9;
    pm.setPoints([pt("in", 0, 0), pt("edge", edgeX, 0), pt("far", farX, 0)], new Set());
    pm.refresh();
    expect(pm.shownIds()).toEqual(["edge", "in"]);
    expect(VIEW_PAD).toBe(1);
  });

  it("keeps the marker of a point that stays and removes one whose point is gone", () => {
    const { pm } = setup();
    // Filter and floor changes hand over the same point objects, so `a` is reused here.
    const a = pt("a", 0, 0);
    pm.setPoints([a, pt("b", 1, 1)], new Set());
    pm.refresh(EVERYWHERE);
    const before = pm.markerFor("a");
    pm.setPoints([a], new Set());
    expect(pm.shownIds()).toEqual(["a"]);
    expect(pm.markerFor("a")).toBe(before);
    expect(pm.markerFor("b")).toBeUndefined();
  });

  it("binds the escaped name as tooltip and builds the popup only when it opens", () => {
    const { pm, map } = setup();
    pm.setPoints([pt("a", 0, 0, { name: "<b>Safe</b>", details: ["Container"] })], new Set());
    pm.refresh(EVERYWHERE);
    const m = pm.markerFor("a")!;
    expect(m.getTooltip()!.getContent()).toBe(upright("&#60;b&#62;Safe&#60;/b&#62;"));
    expect(typeof m.getPopup()!.getContent()).toBe("function");
    m.openPopup();
    const html = map.getContainer().querySelector(".leaflet-popup-content")!.innerHTML;
    expect(html).toContain("&lt;b&gt;Safe&lt;/b&gt;");
    expect(html).toContain("Container");
  });

  it("swaps the icon when a point becomes an item-finder hit and back", () => {
    const { pm } = setup();
    pm.setPoints([pt("a", 0, 0)], new Set());
    pm.refresh(EVERYWHERE);
    expect(pm.markerFor("a")!.getElement()!.classList.contains("hit")).toBe(false);
    pm.setPoints([pt("a", 0, 0)], new Set(["a"]));
    expect(pm.markerFor("a")!.getElement()!.classList.contains("hit")).toBe(true);
    pm.setPoints([pt("a", 0, 0)], new Set());
    expect(pm.markerFor("a")!.getElement()!.classList.contains("hit")).toBe(false);
  });

  it("never culls a marker whose popup is open", () => {
    const { pm } = setup();
    pm.setPoints([pt("a", 0, 0)], new Set());
    pm.refresh(EVERYWHERE);
    pm.markerFor("a")!.openPopup();
    pm.refresh(box(900, 900, 910, 910));
    expect(pm.shownIds()).toEqual(["a"]);
    pm.markerFor("a")!.closePopup();
    pm.refresh(box(900, 900, 910, 910));
    expect(pm.shownIds()).toEqual([]);
  });

  it("rebuilds a marker whose point came back as a new object, keeps one handed over unchanged", () => {
    const { pm } = setup();
    const a = pt("a", 0, 0);
    const b = pt("b", 1, 1);
    pm.setPoints([a, b], new Set());
    pm.refresh(EVERYWHERE);
    const markerA = pm.markerFor("a");
    const markerB = pm.markerFor("b");
    // The daily refresh: same ids, fresh objects, one of them with new content.
    pm.setPoints([pt("a", 0, 0, { name: "Renamed" }), b], new Set());
    pm.refresh(EVERYWHERE);
    expect(pm.markerFor("a")).not.toBe(markerA);
    expect(pm.markerFor("a")!.getTooltip()!.getContent()).toBe(upright("Renamed"));
    expect(pm.markerFor("b")).toBe(markerB);
  });

  it("remembers a point whose picture failed, also after culling and coming back", () => {
    const { pm } = setup();
    const a = pt("a", 0, 0, { icon: "https://assets.tarkov.dev/x-base-image.webp" });
    pm.setPoints([a], new Set());
    pm.refresh(EVERYWHERE);
    const img = pm.markerFor("a")!.getElement()!.querySelector("img")!;
    img.dispatchEvent(new Event("error"));
    expect(pm.markerFor("a")!.getElement()!.tagName).toBe("IMG");
    pm.refresh(box(900, 900, 910, 910));
    pm.refresh(EVERYWHERE);
    // Re-added straight with the group icon: no second attempt at the dead picture.
    expect(pm.markerFor("a")!.getElement()!.tagName).toBe("IMG");
    expect(pm.markerFor("a")!.getElement()!.querySelector("img")).toBeNull();
  });

  it("updates the hit icon of a marker kept only by its open popup", () => {
    const { pm } = setup();
    const a = pt("a", 0, 0);
    pm.setPoints([a], new Set());
    pm.refresh(EVERYWHERE);
    pm.markerFor("a")!.openPopup();
    pm.setPoints([a], new Set(["a"]));
    pm.refresh(box(900, 900, 910, 910));
    expect(pm.shownIds()).toEqual(["a"]);
    expect(pm.markerFor("a")!.getElement()!.classList.contains("hit")).toBe(true);
  });

  it("draws zone outlines whatever the view shows", () => {
    const { pm, group } = setup();
    pm.setPoints([pt("a", 0, 0, { outline: [[0, 0], [10, 0], [10, 10]] })], new Set());
    pm.refresh(box(900, 900, 910, 910));
    expect(pm.shownIds()).toEqual([]);
    expect(group.getLayers().filter((l) => l instanceof L.Polygon)).toHaveLength(1);
    pm.setPoints([], new Set());
    expect(group.getLayers()).toHaveLength(0);
  });

  it("adds in batches, the markers in view before the ones in the padding ring", () => {
    const { pm, map, steps } = setup(true);
    const view = map.getBounds();
    const outsideX = view.getEast() + (view.getEast() - view.getWest()) * 0.5;
    const points: MapPoint[] = [];
    // Listed ring first, so order of arrival cannot be mistaken for input order.
    for (let i = 0; i < 100; i++) points.push(pt(`ring${i}`, outsideX, i));
    for (let i = 0; i < 100; i++) points.push(pt(`in${i}`, i, i));
    pm.setPoints(points, new Set());
    expect(pm.shownIds().length).toBe(ADD_BATCH);
    expect(pm.shownIds().filter((id) => id.startsWith("in"))).toHaveLength(100);
    expect(steps).toHaveLength(1);
    steps.shift()!();
    expect(pm.shownIds()).toHaveLength(200);
    expect(steps).toHaveLength(0);
  });

  it("a new target while a batch is pending replaces it", () => {
    const { pm, steps } = setup(true);
    const points: MapPoint[] = [];
    for (let i = 0; i < ADD_BATCH + 50; i++) points.push(pt(`p${i}`, i, 0));
    pm.setPoints(points, new Set());
    pm.refresh(EVERYWHERE);
    expect(steps).toHaveLength(1);
    pm.refresh(box(-1, -1, 1, 1));
    expect(pm.shownIds()).toEqual(["p0", "p1"]);
    steps.shift()!();
    expect(pm.shownIds()).toEqual(["p0", "p1"]);
  });

  it("dispose empties the group and stops following the map", () => {
    const { pm, map, group, steps } = setup(true);
    const points: MapPoint[] = [];
    for (let i = 0; i < ADD_BATCH + 10; i++) points.push(pt(`p${i}`, i, 0));
    pm.setPoints(points, new Set());
    pm.dispose();
    expect(group.getLayers()).toHaveLength(0);
    for (const s of steps.splice(0)) s();
    map.fire("moveend");
    expect(pm.shownIds()).toEqual([]);
    expect(group.getLayers()).toHaveLength(0);
  });
});

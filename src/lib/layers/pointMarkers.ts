import L from "leaflet";
import { esc } from "../quests/questLayer";
import { toLatLng } from "../map/crs";
import { upright } from "../map/labels";
import { markerIcon, outlineColor, pointIcon, pointPopupHtml } from "./pointLayer";
import type { MapPoint } from "./points";

/** Margin around the view, in viewports per side, inside which a point gets a marker. */
export const VIEW_PAD = 1;
/** Markers added per step; about 0.2 ms each, so a step fits in a frame and the view fills in at once. */
export const ADD_BATCH = 150;

/** Runs `step` later, once; requestAnimationFrame in the app, synchronous in tests. */
export type Defer = (step: () => void) => void;

interface Entry {
  p: MapPoint;
  ll: L.LatLng;
}

interface Shown {
  /** The point the marker was built from; a new object for the same id means new content. */
  p: MapPoint;
  marker: L.Marker;
  hit: boolean;
}

/**
 * The point markers of the current map, limited to the ones near the view. A marker is a DOM element
 * with a paint layer of its own, about 14 KB in the renderer, and Streets with every layer on has
 * three thousand. Markers are added and removed by id as the view moves, so a filter or floor change
 * touches only what changed. A drag moves less than one viewport, so with VIEW_PAD of one it never
 * uncovers an empty area; a wheel notch zooms out 1.25 levels, also inside the pad. Bigger jumps fill
 * in right after the move, in batches of ADD_BATCH per frame with the markers in view first, so the
 * map stays responsive while thousands come in. A marker with an open popup stays until the popup
 * closes. Zone outlines are few and always drawn.
 */
export class PointMarkers {
  private entries: Entry[] = [];
  private hits: ReadonlySet<string> = new Set();
  private shown = new Map<string, Shown>();
  /** Points whose item picture failed to load; the group icon stands in, also after a re-add. */
  private broken = new Set<string>();
  private outlines: L.Polygon[] = [];
  /** What the view wants on the map; `step` brings `shown` to it a batch at a time. */
  private wanted: Entry[] = [];
  private stepQueued = false;
  private disposed = false;
  private readonly onMove = () => this.refresh();

  constructor(
    private readonly map: L.Map,
    private readonly group: L.LayerGroup,
    private readonly defer: Defer = (step) => requestAnimationFrame(step),
  ) {
    map.on("moveend resize", this.onMove);
  }

  setPoints(points: MapPoint[], hits: ReadonlySet<string>): void {
    if (this.disposed) return;
    this.entries = points.map((p) => ({ p, ll: toLatLng(p.x, p.z) }));
    this.hits = hits;
    // A point that vanished, or came back as a new object (the daily data refresh), loses its marker;
    // filter, floor and item-finder changes hand over the same objects, so their markers stay.
    const byId = new Map(points.map((p) => [p.id, p]));
    for (const [id, s] of this.shown) if (byId.get(id) !== s.p) this.drop(id, s);
    for (const o of this.outlines) this.group.removeLayer(o);
    this.outlines = points.filter((p) => p.outline).map((p) => this.outline(p));
    this.refresh();
  }

  /** Targets the markers inside `bounds` (the padded view by default) and starts converging on them. */
  refresh(bounds?: L.LatLngBounds): void {
    if (this.disposed) return;
    // getBounds() is exact here because every map's coordinateRotation is a multiple of 90 degrees.
    const view = this.map.getBounds();
    const target = bounds ?? view.pad(VIEW_PAD);
    // In view first, the padding ring after: what the user looks at fills in within a frame or two.
    const near: Entry[] = [];
    const ring: Entry[] = [];
    for (const e of this.entries) {
      if (!target.contains(e.ll)) continue;
      (view.contains(e.ll) ? near : ring).push(e);
    }
    this.wanted = near.concat(ring);
    const wantedIds = new Set(this.wanted.map((e) => e.p.id));
    for (const [id, s] of this.shown) {
      if (!wantedIds.has(id) && !s.marker.isPopupOpen()) this.drop(id, s);
      else if (s.hit !== this.hits.has(id)) this.setHit(s, this.hits.has(id));
    }
    this.step();
  }

  shownIds(): string[] {
    return [...this.shown.keys()].sort();
  }

  markerFor(id: string): L.Marker | undefined {
    return this.shown.get(id)?.marker;
  }

  dispose(): void {
    this.disposed = true;
    this.stepQueued = false;
    this.map.off("moveend resize", this.onMove);
    this.group.clearLayers();
    this.shown.clear();
    this.broken.clear();
    this.outlines = [];
    this.entries = [];
    this.wanted = [];
  }

  /** Adds up to ADD_BATCH missing markers; queues itself again while some are still missing. */
  private step(): void {
    if (this.disposed) return;
    let added = 0;
    for (const e of this.wanted) {
      if (this.shown.has(e.p.id)) continue;
      if (added === ADD_BATCH) {
        if (!this.stepQueued) {
          this.stepQueued = true;
          this.defer(() => {
            this.stepQueued = false;
            this.step();
          });
        }
        return;
      }
      this.add(e);
      added++;
    }
  }

  private add({ p, ll }: Entry): void {
    const hit = this.hits.has(p.id);
    const marker = L.marker(ll, { icon: this.icon(p, hit) });
    // Popup HTML is built when it opens; a string per marker would sit in memory unused.
    marker.bindTooltip(upright(esc(p.name))).bindPopup(() => pointPopupHtml(p));
    marker.addTo(this.group);
    const s: Shown = { p, marker, hit };
    this.shown.set(p.id, s);
    this.watchImage(s);
  }

  private drop(id: string, s: Shown): void {
    this.group.removeLayer(s.marker);
    this.shown.delete(id);
  }

  private setHit(s: Shown, hit: boolean): void {
    s.hit = hit;
    s.marker.setIcon(this.icon(s.p, hit));
    this.watchImage(s);
  }

  private icon(p: MapPoint, hit: boolean): L.Icon | L.DivIcon {
    return this.broken.has(p.id) ? pointIcon(p, hit) : markerIcon(p, hit);
  }

  /** Offline, or a picture tarkov.dev no longer serves: the group icon takes its place for good. */
  private watchImage(s: Shown): void {
    if (!s.p.icon || this.broken.has(s.p.id)) return;
    s.marker
      .getElement()
      ?.querySelector("img")
      ?.addEventListener(
        "error",
        () => {
          this.broken.add(s.p.id);
          s.marker.setIcon(pointIcon(s.p, s.hit));
        },
        { once: true },
      );
  }

  private outline(p: MapPoint): L.Polygon {
    const color = outlineColor(p);
    return L.polygon(p.outline!.map(([x, z]) => toLatLng(x, z)), {
      pane: "zones",
      color,
      weight: 1,
      opacity: 0.7,
      fillColor: color,
      fillOpacity: 0.12,
      interactive: false,
    }).addTo(this.group);
  }
}

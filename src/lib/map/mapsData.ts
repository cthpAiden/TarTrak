import raw from "../../../data/maps.json";
import floorBounds from "../../../data/floorBounds.json";

export interface MapExtent {
  height: [number, number];
  bounds?: [[number, number], [number, number], string?][];
}
export interface MapLayer {
  name: string;
  svgLayer?: string;
  /** Raster floor drawing, a Leaflet tile URL template; some floors (Reserve's, The Lab's) only exist this way. */
  tilePath?: string;
  show?: boolean;
  extents?: MapExtent[];
}
/** Landmark text placed at game coordinates [x, z]; `size` is a percentage of the base font. */
export interface MapLabel {
  position: [number, number];
  text: string;
  rotation?: number;
  size?: number;
  top?: number;
  bottom?: number;
}
export interface MapDef {
  key: string;
  name: string;
  transform: [number, number, number, number];
  coordinateRotation: number;
  bounds: [[number, number], [number, number]];
  svgPath?: string;
  svgLayer?: string;
  /** Raster map as a Leaflet tile URL template, used when there is no SVG (The Lab, The Labyrinth, Icebreaker). */
  tilePath?: string;
  tileSize: number;
  /** tarkov.dev's variants of this map (Night Factory, Ground Zero 21+): the same ground, the same positions. */
  altKeys: string[];
  layers: MapLayer[];
  labels: MapLabel[];
  minZoom: number;
  maxZoom: number;
}

const DISPLAY_NAMES: Record<string, string> = {
  customs: "Customs",
  factory: "Factory",
  "ground-zero": "Ground Zero",
  interchange: "Interchange",
  lighthouse: "Lighthouse",
  reserve: "Reserve",
  shoreline: "Shoreline",
  "streets-of-tarkov": "Streets of Tarkov",
  "the-lab": "The Lab",
  "the-labyrinth": "The Labyrinth",
  terminal: "Terminal",
  woods: "Woods",
  icebreaker: "Icebreaker",
};

interface RawMap {
  key: string;
  projection: string;
  transform: [number, number, number, number];
  coordinateRotation?: number;
  bounds: [[number, number], [number, number]];
  svgPath?: string;
  svgLayer?: string;
  tilePath?: string;
  tileSize?: number;
  altMaps?: string[];
  layers?: MapLayer[];
  labels?: MapLabel[];
  minZoom?: number;
  maxZoom?: number;
}
interface RawGroup {
  normalizedName: string;
  maps: RawMap[];
}

let cache: MapDef[] | null = null;

/**
 * tarkov.dev leaves some floor extents unbounded: Shoreline's "2nd Floor" is anything between -1 and
 * 2 m anywhere on the map, which would put a hillside at that height on the resort's 2nd floor.
 * data/floorBounds.json (scripts/floor-bounds.mjs) traces the floor drawings in the map SVG into
 * per-building rectangles; an extent without bounds of its own gets them.
 */
function withDerivedBounds(mapKey: string, layer: MapLayer): MapLayer {
  const derived = (floorBounds as unknown as Record<string, Record<string, MapExtent["bounds"]>>)[mapKey]?.[layer.name];
  if (!derived || !layer.extents) return layer;
  return { ...layer, extents: layer.extents.map((e) => (e.bounds ? e : { ...e, bounds: derived })) };
}

export function loadMapDefs(): MapDef[] {
  if (cache) return cache;
  const groups = raw as unknown as RawGroup[];
  cache = groups.flatMap((g) =>
    g.maps
      .filter((m) => m.projection === "interactive")
      .map((m) => ({
        key: m.key,
        name: DISPLAY_NAMES[m.key] ?? m.key,
        transform: m.transform,
        coordinateRotation: m.coordinateRotation ?? 0,
        bounds: m.bounds,
        svgPath: m.svgPath,
        svgLayer: m.svgLayer,
        tilePath: m.tilePath,
        tileSize: m.tileSize ?? 256,
        altKeys: m.altMaps ?? [],
        layers: (m.layers ?? []).map((l) => withDerivedBounds(m.key, l)),
        labels: (m.labels ?? []).filter((l) => Array.isArray(l.position) && typeof l.text === "string"),
        minZoom: m.minZoom ?? 1,
        maxZoom: m.maxZoom ?? 5,
      })),
  );
  return cache;
}

export function getMapDef(key: string): MapDef | undefined {
  return loadMapDefs().find((d) => d.key === key);
}

/** The map an alt key is a variant of, e.g. "night-factory" -> "factory"; any other key comes back as is. */
export function primaryMapKey(key: string): string {
  return loadMapDefs().find((d) => d.altKeys.includes(key))?.key ?? key;
}

function inBounds(b: [[number, number], [number, number], string?], x: number, z: number): boolean {
  const [ax, az] = b[0];
  const [bx, bz] = b[1];
  return x >= Math.min(ax, bx) && x <= Math.max(ax, bx) && z >= Math.min(az, bz) && z <= Math.max(az, bz);
}

/** Name of the floor layer whose extents contain the position, or null for the base level. */
export function floorForHeight(def: MapDef, pos: { x: number; y: number; z: number }): string | null {
  for (const layer of def.layers) {
    for (const ext of layer.extents ?? []) {
      const [lo, hi] = ext.height;
      if (pos.y < lo || pos.y >= hi) continue;
      if (!ext.bounds || ext.bounds.some((b) => inBounds(b, pos.x, pos.z))) return layer.name;
    }
  }
  return null;
}

export type Containment = "full" | "partial" | false;

/**
 * How a vertical span [bottom, top] at (x, z) relates to one floor layer's extents.
 * A layer without extents never claims a marker.
 */
export function onLayer(layer: MapLayer, x: number, z: number, top: number, bottom: number): Containment {
  for (const ext of layer.extents ?? []) {
    const [lo, hi] = ext.height;
    if (top < lo || bottom >= hi) continue;
    const how: Containment = bottom >= lo && top <= hi ? "full" : "partial";
    if (!ext.bounds || ext.bounds.some((b) => inBounds(b, x, z))) return how;
  }
  return false;
}

/**
 * Whether a marker belongs on the floor currently shown. `activeFloor` null is the base level.
 * A marker is hidden when it sits fully inside a bounded extent of an inactive layer; otherwise it
 * is shown when it is on the active layer, or, on the base level, when it is not fully inside any
 * layer's extents. Height alone never hides a marker: the ground itself climbs above tarkov.dev's
 * nominal ground band on Shoreline's hills and dips below it on Reserve.
 *
 * `top`/`bottom` default to `y`. Landmark labels pass the sentinel span [-1000, 1000], which is why
 * the base-level test uses full containment rather than any overlap: a label that spans every floor
 * belongs to all of them, exactly as tarkov.dev's "partial" containment keeps it visible.
 */
export function visibleOnFloor(
  def: MapDef,
  activeFloor: string | null,
  x: number,
  z: number,
  y: number,
  top = y,
  bottom = y,
): boolean {
  for (const layer of def.layers) {
    if (layer.name === activeFloor) continue;
    if (!(layer.extents ?? []).some((e) => e.bounds)) continue;
    if (onLayer(layer, x, z, top, bottom) === "full") return false;
  }
  if (activeFloor !== null) {
    const layer = def.layers.find((l) => l.name === activeFloor);
    return !!layer && onLayer(layer, x, z, top, bottom) !== false;
  }
  return !def.layers.some((l) => onLayer(l, x, z, top, bottom) === "full");
}

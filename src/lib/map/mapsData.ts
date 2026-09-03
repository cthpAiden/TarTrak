import raw from "../../../data/maps.json";

export interface MapExtent {
  height: [number, number];
  bounds?: [[number, number], [number, number], string?][];
}
export interface MapLayer {
  name: string;
  svgLayer?: string;
  show?: boolean;
  extents?: MapExtent[];
}
export interface MapDef {
  key: string;
  name: string;
  transform: [number, number, number, number];
  coordinateRotation: number;
  bounds: [[number, number], [number, number]];
  svgPath?: string;
  svgLayer?: string;
  heightRange?: [number, number];
  layers: MapLayer[];
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
  heightRange?: [number, number];
  layers?: MapLayer[];
  minZoom?: number;
  maxZoom?: number;
}
interface RawGroup {
  normalizedName: string;
  maps: RawMap[];
}

let cache: MapDef[] | null = null;

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
        heightRange: m.heightRange,
        layers: m.layers ?? [],
        minZoom: m.minZoom ?? 1,
        maxZoom: m.maxZoom ?? 5,
      })),
  );
  return cache;
}

export function getMapDef(key: string): MapDef | undefined {
  return loadMapDefs().find((d) => d.key === key);
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

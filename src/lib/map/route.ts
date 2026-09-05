import { CATEGORY_LABELS, type MapPoint } from "../layers/points";

/** Straight-line distance in whole metres; Tarkov's game units are metres. */
export function distanceM(a: { x: number; z: number }, b: { x: number; z: number }): number {
  return Math.round(Math.hypot(a.x - b.x, a.z - b.z));
}

export interface RouteGroup {
  category: string;
  label: string;
  items: MapPoint[];
}

/** The order a PMC reads an extract list in: what I can use alone first, Scav-only and transits last. */
const CATEGORY_RANK = ["pmc", "shared", "coop", "scav", "transit"];
function rank(c: string): number {
  const i = CATEGORY_RANK.indexOf(c);
  return i === -1 ? CATEGORY_RANK.length : i;
}

/** Extracts on the map, grouped under the filter panel's labels, names sorted within a group. */
export function routeGroups(points: MapPoint[]): RouteGroup[] {
  const by = new Map<string, MapPoint[]>();
  for (const p of points) {
    if (p.group !== "extracts") continue;
    const list = by.get(p.category) ?? [];
    list.push(p);
    by.set(p.category, list);
  }
  return [...by.keys()]
    .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
    .map((category) => ({
      category,
      label: CATEGORY_LABELS[`extracts/${category}`] ?? category,
      items: by.get(category)!.sort((a, b) => a.name.localeCompare(b.name)),
    }));
}

import type { Teammate } from "../state/app.svelte";

export interface SquadRow {
  id: string;
  name: string;
  color: string;
  /** Display name of the teammate's map, or null when it is unknown. */
  mapName: string | null;
  sameMap: boolean;
  ageSec: number;
  /** Whole metres to me, or null when we are not on the same map. */
  distanceM: number | null;
}

/** Rows for the squad list: same map first, then by name. */
export function squadRows(
  teammates: Teammate[],
  me: { map: string | null; x: number; z: number } | null,
  now: number,
  mapName: (key: string) => string | null,
): SquadRow[] {
  return teammates
    .map((t) => {
      const sameMap = me !== null && me.map !== null && t.map === me.map;
      return {
        id: t.id,
        name: t.name,
        color: t.color,
        mapName: t.map ? mapName(t.map) : null,
        sameMap,
        ageSec: Math.max(0, Math.round((now - t.receivedAt) / 1000)),
        distanceM: sameMap && me ? Math.round(Math.hypot(t.x - me.x, t.z - me.z)) : null,
      };
    })
    .sort((a, b) => (a.sameMap === b.sameMap ? a.name.localeCompare(b.name) : a.sameMap ? -1 : 1));
}

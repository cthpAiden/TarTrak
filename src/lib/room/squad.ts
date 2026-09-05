import type { Teammate } from "../state/app.svelte";

export interface SquadRow {
  id: string;
  name: string;
  color: string;
  /** Display name of the teammate's map, or null when it is unknown. */
  mapName: string | null;
  /** Drawn on my map: same map key, or no map of their own while I have one (a squad shares a raid). */
  sameMap: boolean;
  /** They reported a position but no map: their marker is on my map on that assumption. */
  mapUnknown: boolean;
  /** They joined but have not taken a screenshot yet. */
  noPosition: boolean;
  ageSec: number;
  /** Whole metres to me, or null when one of us has no position or we are not on the same map. */
  distanceM: number | null;
}

/** The relay accepts any string as a colour, so never let one reach a style unchecked. */
export function safeColor(c: string): string {
  return /^#[0-9a-fA-F]{3,8}$/.test(c) ? c : "#888888";
}

export interface Me {
  map: string | null;
  pos: { x: number; z: number } | null;
}

/** Rows for the squad list: same map first, then by name. */
export function squadRows(teammates: Teammate[], me: Me, now: number, mapName: (key: string) => string | null): SquadRow[] {
  return teammates
    .map((t) => {
      const noPosition = t.noPosition === true;
      const mapUnknown = !noPosition && t.map === null;
      const sameMap = !noPosition && me.map !== null && (t.map === me.map || mapUnknown);
      return {
        id: t.id,
        name: t.name,
        color: t.color,
        mapName: t.map ? mapName(t.map) : null,
        sameMap,
        mapUnknown,
        noPosition,
        ageSec: Math.max(0, Math.round((now - t.receivedAt) / 1000)),
        distanceM: sameMap && me.pos ? Math.round(Math.hypot(t.x - me.pos.x, t.z - me.pos.z)) : null,
      };
    })
    .sort((a, b) => (a.sameMap === b.sameMap ? a.name.localeCompare(b.name) : a.sameMap ? -1 : 1));
}

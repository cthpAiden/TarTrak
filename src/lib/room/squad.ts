import type { Teammate } from "../state/app.svelte";

export interface SquadRow {
  id: string;
  name: string;
  /** Colour they are drawn in on my screen: my override for their name, else the one they sent. */
  color: string;
  /** True when `color` is one I picked rather than the one they sent. */
  customColor: boolean;
  /** Display name of the teammate's map, or null when it is unknown. */
  mapName: string | null;
  /** Drawn on my map: same map key, or no map of their own while I have one (a squad shares a raid). */
  sameMap: boolean;
  /** They reported a position but no map: their marker is on my map on that assumption. */
  mapUnknown: boolean;
  /** They joined but have not taken a screenshot yet. */
  noPosition: boolean;
  /** Floor layer name their height puts them on; null for ground level or when unknown. */
  floor: string | null;
  ageSec: number;
  /** Whole metres to me, or null when one of us has no position or we are not on the same map. */
  distanceM: number | null;
}

/** The relay accepts any string as a colour, so never let one reach a style unchecked. */
export function safeColor(c: string): string {
  return /^#[0-9a-fA-F]{3,8}$/.test(c) ? c : "#888888";
}

/** The colour a teammate is drawn in on my screen: my override for their name first, then what they sent. */
export function mateColor(name: string, sent: string, overrides: Record<string, string>): string {
  return safeColor(overrides[name] ?? sent);
}

/** Short floor tag for a name label: "2nd Floor" reads "2F"; other layers keep their name; ground level has none. */
export function floorTag(layer: string | null): string | null {
  if (layer === null) return null;
  const m = /^(\d+)(?:st|nd|rd|th) Floor$/i.exec(layer);
  return m ? `${m[1]}F` : layer;
}

/** "Aiden [2F]", or just the name on the ground level. */
export function mateLabel(name: string, tag: string | null): string {
  return tag ? `${name} [${tag}]` : name;
}

export interface Me {
  map: string | null;
  pos: { x: number; z: number } | null;
}

export interface SquadLookups {
  mapName: (key: string) => string | null;
  /** Floor for a position on my map; only asked for teammates drawn on it. */
  floorOf?: (t: Teammate) => string | null;
  /** Colours I picked for teammates, by name; they beat the colour the teammate sent. */
  colorOverrides?: Record<string, string>;
}

/** Rows for the squad list: same map first, then by name. */
export function squadRows(teammates: Teammate[], me: Me, now: number, lookups: SquadLookups | ((key: string) => string | null)): SquadRow[] {
  const { mapName, floorOf, colorOverrides } =
    typeof lookups === "function" ? { mapName: lookups, floorOf: undefined, colorOverrides: undefined } : lookups;
  return teammates
    .map((t) => {
      const noPosition = t.noPosition === true;
      const mapUnknown = !noPosition && t.map === null;
      const sameMap = !noPosition && me.map !== null && (t.map === me.map || mapUnknown);
      const override = colorOverrides?.[t.name];
      return {
        id: t.id,
        name: t.name,
        color: override ?? t.color,
        customColor: override !== undefined,
        mapName: t.map ? mapName(t.map) : null,
        sameMap,
        mapUnknown,
        noPosition,
        floor: sameMap && floorOf ? floorOf(t) : null,
        ageSec: Math.max(0, Math.round((now - t.receivedAt) / 1000)),
        distanceM: sameMap && me.pos ? Math.round(Math.hypot(t.x - me.pos.x, t.z - me.pos.z)) : null,
      };
    })
    .sort((a, b) => (a.sameMap === b.sameMap ? a.name.localeCompare(b.name) : a.sameMap ? -1 : 1));
}

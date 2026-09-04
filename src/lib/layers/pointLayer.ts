import L from "leaflet";
import { esc } from "../quests/questLayer";
import { filterKey, type GroupId, type MapPoint } from "./points";

export const GLYPHS: Record<GroupId, string> = {
  extracts: "⇲",
  spawns: "✦",
  loot: "",
  lootLoose: "",
  locks: "🔒",
  hazards: "☢",
  switches: "⏻",
  guns: "⌖",
  btr: "⛟",
};

/** Dense groups draw as canvas circles: a busy map has over a thousand of them. */
export function usesCanvas(group: GroupId): boolean {
  return group === "loot" || group === "lootLoose" || group === "spawns";
}

const GROUP_COLORS: Record<GroupId, string> = {
  extracts: "#7fd47f",
  spawns: "#f0d060",
  loot: "#d2b48c",
  lootLoose: "#e0d8a0",
  locks: "#b0b8c0",
  hazards: "#ff5c5c",
  switches: "#5ce0e6",
  guns: "#d0d0d0",
  btr: "#a8b060",
};

const CATEGORY_COLORS: Record<string, string> = {
  "extracts/pmc": "#7fd47f",
  "extracts/scav": "#ffa64d",
  "extracts/shared": "#7fc7ff",
  "extracts/transit": "#c58bff",
  "spawns/pmc": "#f0d060",
  "spawns/scav": "#ffa64d",
  "spawns/sniper": "#ffffff",
  "spawns/boss": "#ff5c5c",
  "spawns/cultist-priest": "#b06cff",
  "spawns/rogue": "#ff9c3c",
  "spawns/black-div": "#c8c8c8",
  "spawns/af": "#ffd23c",
  "spawns/bloodhound": "#ff6cb0",
};

/** Canvas paths ignore CSS classes, so circle markers need the colour as an option. */
export function colorFor(p: { group: GroupId; category: string }): string {
  return CATEGORY_COLORS[filterKey(p)] ?? GROUP_COLORS[p.group];
}

export function pointDivIcon(p: MapPoint): L.DivIcon {
  return L.divIcon({
    className: `point-icon ${p.group} ${p.category}`,
    html: `<span title="${esc(p.name)}">${GLYPHS[p.group]}</span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

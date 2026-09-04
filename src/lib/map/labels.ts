import L from "leaflet";
import { esc } from "../quests/questLayer";
import type { MapLabel } from "./mapsData";

const BASE_PX = 13;
const MIN_PX = 9;

/** Font size in px for a label; `size` is a percentage of the base, missing means 100. */
export function labelPx(size: number | undefined): number {
  return Math.max(MIN_PX, Math.round((BASE_PX * (size ?? 100)) / 100));
}

export function labelDivIcon(l: MapLabel): L.DivIcon {
  const rot = l.rotation ?? 0;
  return L.divIcon({
    className: "map-label",
    html: `<span style="font-size:${labelPx(l.size)}px;transform:translate(-50%,-50%) rotate(${rot}deg)">${esc(l.text)}</span>`,
    iconSize: [0, 0],
  });
}

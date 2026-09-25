import L from "leaflet";
import { esc } from "../quests/questLayer";
import type { MapLabel } from "./mapsData";

const BASE_PX = 13;
const MIN_PX = 9;

/** Font size in px for a label; `size` is a percentage of the base, missing means 100. */
export function labelPx(size: number | undefined): number {
  return Math.max(MIN_PX, Math.round((BASE_PX * (size ?? 100)) / 100));
}

/**
 * Wraps tooltip HTML so it can stand upright on a turning map: the tooltip element itself is placed by
 * Leaflet's transform, so only a child can be counter-rotated (map.css, `.map-root.rotated .upright`).
 */
export function upright(html: string): string {
  return `<span class="upright">${html}</span>`;
}

export function labelDivIcon(l: MapLabel): L.DivIcon {
  const rot = l.rotation ?? 0;
  // --counter is the map's own turn (0 unless the round minimap is heading-up), so the label stays readable.
  return L.divIcon({
    className: "map-label",
    html: `<span style="font-size:${labelPx(l.size)}px;transform:translate(-50%,-50%) rotate(calc(${rot}deg + var(--counter, 0deg)))">${esc(l.text)}</span>`,
    iconSize: [0, 0],
  });
}

import L from "leaflet";
import { esc } from "../quests/questLayer";
import type { GroupId, MapPoint } from "./points";

/**
 * Marker icons are the tarkov.dev interactive-map set (MIT, the-hideout/tarkov-dev,
 * public/maps/interactive), copied to public/icons with its licence. File names follow
 * tarkov.dev's map-images.mjs so every category draws the same picture as the site.
 */
export const ICON_DIR = "/icons";

/** Containers whose normalizedName has no picture of its own borrow one, as on tarkov.dev. */
const CONTAINER_ALIASES: Record<string, string> = {
  "bank-cash-register": "cash-register",
  "bank-safe": "safe",
  "cash-register-tar2-2": "cash-register",
  "dead-civilian": "dead-scav",
  "pmc-body": "dead-scav",
  "civilian-body": "dead-scav",
  "lab-technician-body": "dead-scav",
  "scav-body": "dead-scav",
  "medical-supply-crate": "crate",
  "ration-supply-crate": "crate",
  "technical-supply-crate": "crate",
  "shturmans-stash": "weapon-box",
};

const CONTAINER_ICONS = new Set([
  "buried-barrel-cache", "cash-register", "crate", "dead-scav", "drawer", "duffle-bag", "grenade-box",
  "ground-cache", "jacket", "medbag-smu06", "medcase", "pc-block", "plastic-suitcase", "safe", "toolbox",
  "weapon-box", "wooden-ammo-box", "wooden-crate",
]);

const SPAWN_ICONS: Record<string, string> = {
  pmc: "spawn_pmc",
  scav: "spawn_scav",
  sniper: "spawn_sniper_scav",
  boss: "spawn_boss",
  "cultist-priest": "spawn_cultist-priest",
  rogue: "spawn_rogue",
  "black-div": "spawn_black-div",
  af: "spawn_af",
  bloodhound: "spawn_bloodhound",
};

const GROUP_ICONS: Record<Exclude<GroupId, "extracts" | "spawns" | "loot">, string> = {
  lootLoose: "loose_loot",
  locks: "lock",
  hazards: "hazard",
  switches: "switch",
  guns: "stationarygun",
  btr: "btr_stop",
};

/** Icon file stem (without directory or .png) for a point, or a filter row with the same shape. */
export function iconFile(p: { group: GroupId; category: string }): string {
  switch (p.group) {
    case "extracts":
      return `extract_${p.category}`;
    case "spawns":
      return SPAWN_ICONS[p.category] ?? "spawn_boss";
    case "loot": {
      const stem = CONTAINER_ALIASES[p.category] ?? p.category;
      return `container_${CONTAINER_ICONS.has(stem) ? stem : "crate"}`;
    }
    default:
      return GROUP_ICONS[p.group];
  }
}

export function iconUrl(p: { group: GroupId; category: string }): string {
  return `${ICON_DIR}/${iconFile(p)}.png`;
}

/** The point's details plus its height, which is only ever shown here. */
export function pointPopupHtml(p: MapPoint): string {
  const lines = [...p.details, `Elevation ${p.y.toFixed(1)}`];
  return `<b>${esc(p.name)}</b><br><small>${lines.map(esc).join("<br>")}</small>`;
}

/** 24px image marker; PMC spawn arrows point at their spot, so they hang from the bottom edge like on tarkov.dev. */
export function pointIcon(p: MapPoint, hit = false): L.Icon {
  const pmcSpawn = p.group === "spawns" && p.category === "pmc";
  return L.icon({
    iconUrl: iconUrl(p),
    iconSize: [24, 24],
    iconAnchor: pmcSpawn ? [12, 24] : [12, 12],
    popupAnchor: pmcSpawn ? [0, -24] : [0, -12],
    className: `point-icon ${p.group} ${p.category}${hit ? " hit" : ""}`,
  });
}

import { primaryMapKey } from "../map/mapsData";
import itemCategories from "../../../data/itemCategories.json";
import { itemImageUrl, lootCategoryImage } from "./itemImages";
import type { Footprint, MapBoss, MapInfo, MapSpawn, QuestData, Vec3 } from "../quests/types";

export type GroupId =
  | "extracts"
  | "spawns"
  | "loot"
  | "lootLoose"
  | "locks"
  | "hazards"
  | "switches"
  | "guns"
  | "btr";

export const GROUP_ORDER: readonly GroupId[] = [
  "extracts",
  "spawns",
  "loot",
  "lootLoose",
  "locks",
  "hazards",
  "switches",
  "guns",
  "btr",
];

export const GROUP_LABELS: Record<GroupId, string> = {
  extracts: "Extracts",
  spawns: "Spawns",
  loot: "Containers",
  lootLoose: "Loose Loot",
  locks: "Locks",
  hazards: "Hazards",
  switches: "Switches",
  guns: "Stationary Guns",
  btr: "BTR",
};

export const CATEGORY_LABELS: Record<string, string> = {
  "extracts/pmc": "PMC Extracts",
  "extracts/scav": "SCAV Extracts",
  "extracts/shared": "PMC & Scav Extracts",
  "extracts/coop": "Co-op Extracts (PMC + Scav)",
  "extracts/transit": "Transit Zones",
  "spawns/pmc": "PMC",
  "spawns/scav": "Scav",
  "spawns/sniper": "Sniper Scav",
  "spawns/boss": "Boss",
  "spawns/cultist-priest": "Cultist Priest",
  "spawns/rogue": "Rogues",
  "spawns/black-div": "Black Division",
  "spawns/af": "Arena Fighters",
  "spawns/bloodhound": "Bloodhounds",
  "lootLoose/other": "Other loose loot",
  "locks/door": "Doors",
  "locks/container": "Containers",
  "locks/trunk": "Trunks",
  "locks/switch": "Switches",
  "hazards/minefield": "Minefields",
  "hazards/hazard": "Hazards",
  "hazards/sniper": "Sniper zones",
  "hazards/mortar": "Mortar zones",
  "switches/switch": "Switches",
  "guns/gun": "Stationary guns",
  "btr/stop": "BTR stops",
};

export interface MapPoint extends Footprint {
  id: string;
  group: GroupId;
  category: string;
  name: string;
  mapKey: string;
  x: number;
  y: number;
  z: number;
  /** Short, already human-readable extra lines for the point's popup. */
  details: string[];
  /** Every filter row the point belongs to when there is more than one (loose loot with items of several categories); `category` is the first. */
  categories?: string[];
  /** Picture drawn as the marker instead of the group icon: the item of a single-item loot spot, the category picture of a single-category one. */
  icon?: string;
  /** Picture shown in the popup: the item of a loot spot, the key of a lock, the item an extract wants. */
  image?: string;
}

/** Handbook category names by slug, tarkov.dev's loose loot filter rows. */
const LOOT_CATEGORY_LABELS = (itemCategories as { categories: Record<string, string> }).categories;

export function filterKey(p: { group: string; category: string }): string {
  return `${p.group}/${p.category}`;
}

/** Bosses that get their own map layer on tarkov.dev rather than sharing the boss one. */
const OWN_LAYER_BOSSES = ["cultist-priest", "rogue", "black-div", "af", "bloodhound"];

const SCAV_SPAWN = { category: "scav", name: "Scav spawn" };

/** Bosses tarkov.dev spawns in the zone; each once, however many spawn entries it has there. */
function bossesInZone(spawn: MapSpawn, mapBosses: MapBoss[]): MapBoss[] {
  const matched = mapBosses.filter((b) => spawn.zoneName !== null && b.spawnKeys.includes(spawn.zoneName));
  return matched.filter((b, i) => matched.findIndex((o) => o.normalizedName === b.normalizedName) === i);
}

/** "Reshala: 60%, 4 guards" per boss of a boss spawn; its chance, escort and switch trigger from tarkov.dev. */
export function bossDetails(spawn: MapSpawn, mapBosses: MapBoss[]): string[] {
  if (!spawn.categories.includes("boss")) return [];
  return bossesInZone(spawn, mapBosses).map((b) => {
    const parts = [`${Math.round(b.spawnChance * 100)}%`];
    if (b.escorts) parts.push(`${b.escorts} ${b.escorts === 1 ? "guard" : "guards"}`);
    if (b.trigger === "Switch") parts.push("spawns on a switch");
    return `${b.name}: ${parts.join(", ")}`;
  });
}

/**
 * Mirrors tarkov.dev's spawn classification. Returns null for the spawns it draws
 * nothing for: a boss zone with no boss and no scav bot, and any other odd combination.
 */
export function classifySpawn(spawn: MapSpawn, mapBosses: MapBoss[]): { category: string; name: string } | null {
  if (spawn.categories.includes("boss")) {
    const bosses = bossesInZone(spawn, mapBosses);
    if (bosses.length === 0) {
      return spawn.categories.includes("bot") && spawn.sides.includes("scav") ? SCAV_SPAWN : null;
    }
    if (bosses.length === 1 && OWN_LAYER_BOSSES.includes(bosses[0].normalizedName)) {
      return { category: bosses[0].normalizedName, name: bosses[0].name };
    }
    return {
      category: "boss",
      name: bosses.map((b) => `${b.name} (${Math.round(b.spawnChance * 100)}%)`).join(", "),
    };
  }
  if (spawn.categories.includes("player")) {
    const isPmc = spawn.sides.includes("pmc") || spawn.sides.includes("all");
    return isPmc ? { category: "pmc", name: "PMC spawn" } : null;
  }
  if (spawn.categories.includes("sniper")) return { category: "sniper", name: "Sniper Scav" };
  if (spawn.sides.includes("scav") && (spawn.categories.includes("bot") || spawn.categories.includes("all"))) {
    return SCAV_SPAWN;
  }
  return null;
}

/** "Bolts, Screws, Nuts +2" for a long list, "Loose loot" for an empty one. */
function looseLootName(items: string[]): string {
  if (items.length === 0) return "Loose loot";
  const head = items.slice(0, 3).join(", ");
  return items.length > 3 ? `${head} +${items.length - 3}` : head;
}

const EXTRACT_DETAILS: Record<string, string> = {
  pmc: "PMC extract",
  scav: "Scav extract",
  shared: "PMC & Scav extract",
  coop: "Co-op extract: a PMC and a Scav must leave together",
  transit: "Transit",
};

/**
 * tarkov.dev files co-op extracts under "shared", but unlike Emercom Checkpoint they only open when a
 * PMC and a Scav stand in them together; the game names them "(Co-Op)", which is the only marker.
 */
function extractCategory(e: MapInfo["extracts"][number]): string {
  return /\(co-?op\)/i.test(e.name) ? "coop" : e.faction;
}

const LOCK_DETAILS: Record<string, string> = {
  door: "Door",
  container: "Container",
  trunk: "Car door or trunk",
  switch: "Switch-operated",
};

function push(
  out: MapPoint[],
  mapKey: string,
  group: GroupId,
  category: string,
  name: string,
  id: string,
  position: Vec3 | null,
  details: string[],
  foot?: Footprint,
): MapPoint | null {
  if (!position) return null;
  const p: MapPoint = { id, group, category, name, mapKey, x: position.x, y: position.y, z: position.z, details };
  if (foot?.outline) p.outline = foot.outline;
  if (foot?.top !== undefined) p.top = foot.top;
  if (foot?.bottom !== undefined) p.bottom = foot.bottom;
  out.push(p);
  return p;
}

function extractDetails(e: MapInfo["extracts"][number]): string[] {
  // An unknown faction still gets a readable line rather than vanishing behind a missing label.
  const details = [EXTRACT_DETAILS[extractCategory(e)] ?? `${e.faction} extract`];
  for (const sw of e.switches ?? []) details.push(`Activated by switch: ${sw}`);
  if (e.requiredItem) {
    const count = e.requiredItem.count > 1 ? ` ×${e.requiredItem.count.toLocaleString("en-US")}` : "";
    details.push(`Requires ${e.requiredItem.name}${count}`);
  }
  return details;
}

/** The points of one tarkov.dev map entry, tagged with the app map key `key`. */
function pointsForMap(m: MapInfo, key: string): MapPoint[] {
  const out: MapPoint[] = [];
  for (const e of m.extracts ?? []) {
    const p = push(out, key, "extracts", extractCategory(e), e.name, e.id, e.position, extractDetails(e), e);
    if (p && e.requiredItem?.image) p.image = itemImageUrl(e.requiredItem.image);
  }
  (m.transits ?? []).forEach((t, i) => {
    push(out, key, "extracts", "transit", t.description, t.id || `extracts/transit/${i}`, t.position, [
      EXTRACT_DETAILS.transit,
      ...(t.conditions ? [t.conditions] : []),
    ], t);
  });
  (m.spawns ?? []).forEach((s, i) => {
    const spawn = classifySpawn(s, m.bosses ?? []);
    if (!spawn) return;
    const detail = CATEGORY_LABELS[`spawns/${spawn.category}`] ?? spawn.category;
    push(out, key, "spawns", spawn.category, spawn.name, `spawns/${spawn.category}/${i}`, s.position, [detail, ...bossDetails(s, m.bosses ?? [])]);
  });
  (m.lootContainers ?? []).forEach((c, i) => {
    const category = c.lootContainer.normalizedName;
    push(out, key, "loot", category, c.lootContainer.name, `loot/${category}/${i}`, c.position, ["Container"]);
  });
  (m.lootLoose ?? []).forEach((l, i) => {
    // One marker in every category row its items fall in, like tarkov.dev; the first names the id.
    const categories = l.categories?.length ? l.categories : ["other"];
    const p = push(out, key, "lootLoose", categories[0], looseLootName(l.items), `lootLoose/${categories[0]}/${i}`, l.position, [...l.items]);
    if (!p) return;
    if (categories.length > 1) p.categories = categories;
    // Drawn like tarkov.dev: the item itself for a single-item spot, its category's picture for a single-category one.
    if (l.image) {
      p.icon = itemImageUrl(l.image);
      p.image = p.icon;
    } else if (categories.length === 1) {
      const image = lootCategoryImage(categories[0]);
      if (image) p.icon = image;
    }
  });
  (m.locks ?? []).forEach((l, i) => {
    const p = push(out, key, "locks", l.lockType, l.key ?? `Locked ${l.lockType}`, `locks/${l.lockType}/${i}`, l.position, [
      LOCK_DETAILS[l.lockType] ?? l.lockType,
      ...(l.needsPower ? ["Needs power"] : []),
    ]);
    if (p && l.keyImage) p.image = itemImageUrl(l.keyImage);
  });
  (m.hazards ?? []).forEach((h, i) => {
    push(out, key, "hazards", h.hazardType, h.name, `hazards/${h.hazardType}/${i}`, h.position, [
      CATEGORY_LABELS[`hazards/${h.hazardType}`] ?? h.hazardType,
    ], h);
  });
  (m.switches ?? []).forEach((s, i) => {
    // "Unlocks Saferoom Exfil", "Locks Alarm Switch": the operation verb plus its target.
    const does = (s.activates ?? []).map((a) => `${a.operation}s ${a.target}`);
    push(out, key, "switches", "switch", s.name, s.id || `switches/switch/${i}`, s.position, ["Switch", ...does]);
  });
  (m.stationaryWeapons ?? []).forEach((w, i) => {
    push(out, key, "guns", "gun", w.name, `guns/gun/${i}`, w.position, ["Stationary gun"]);
  });
  (m.btrStations ?? []).forEach((b, i) => {
    push(out, key, "btr", "stop", b.name, b.id || `btr/stop/${i}`, b.position, ["BTR stop"]);
  });
  return out;
}

/**
 * Points of every map, or of the one map `mapKey` names. tarkov.dev's variants of a map (Night
 * Factory, Ground Zero 21+, The Lab (Dark)) fold onto it: their own loot spots and boss spawns are
 * added after the map's, a spot both list is drawn once, and their synthesised ids carry the
 * variant's name so they stay distinct. A variant's extracts are the map's own under the same
 * names (their positions differ by a rounding error and they come without a faction), so a name
 * the map already has is not drawn again.
 */
export function extractPoints(data: QuestData, mapKey?: string): MapPoint[] {
  const out: MapPoint[] = [];
  const seen = new Set<string>();
  const at = (p: MapPoint) =>
    p.group === "extracts" ? `${p.mapKey}|extracts|${p.name}` : `${p.mapKey}|${p.group}|${p.category}|${p.x}|${p.y}|${p.z}`;
  const wanted = data.maps.filter((m) => mapKey === undefined || primaryMapKey(m.normalizedName) === mapKey);
  const isVariant = (m: MapInfo) => primaryMapKey(m.normalizedName) !== m.normalizedName;
  for (const m of wanted.filter((m) => !isVariant(m))) {
    for (const p of pointsForMap(m, m.normalizedName)) {
      seen.add(at(p));
      out.push(p);
    }
  }
  for (const m of wanted.filter(isVariant)) {
    for (const p of pointsForMap(m, primaryMapKey(m.normalizedName))) {
      if (seen.has(at(p))) continue;
      seen.add(at(p));
      out.push({ ...p, id: `${m.normalizedName}/${p.id}` });
    }
  }
  return out;
}

/**
 * Ids of the points that carry an item whose name contains the query: loose loot spots, plus locks
 * (their key) and stationary guns. Empty query, empty result. Containers list no items, so never them.
 */
export function findItem(points: MapPoint[], query: string): Set<string> {
  const q = query.trim().toLowerCase();
  const out = new Set<string>();
  if (q.length < 2) return out;
  for (const p of points) {
    if (p.group !== "lootLoose" && p.group !== "locks" && p.group !== "guns") continue;
    const haystack = p.group === "lootLoose" ? p.details : [p.name];
    if (haystack.some((d) => d.toLowerCase().includes(q))) out.add(p.id);
  }
  return out;
}

/** Label for a category key: CATEGORY_LABELS, else the name of the first point with that key, else the slug. */
export function categoryLabel(key: string, points: MapPoint[]): string {
  const fixed = CATEGORY_LABELS[key] ?? (key.startsWith("lootLoose/") ? LOOT_CATEGORY_LABELS[key.slice("lootLoose/".length)] : undefined);
  if (fixed) return fixed;
  const hit = points.find((p) => filterKey(p) === key);
  if (hit) return hit.name;
  return key.slice(key.indexOf("/") + 1);
}

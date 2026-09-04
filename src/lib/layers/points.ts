import type { MapInfo, QuestData, Vec3 } from "../quests/types";

export type GroupId = "extracts" | "spawns" | "loot" | "locks" | "hazards" | "switches" | "btr";

export const GROUP_ORDER: readonly GroupId[] = [
  "extracts",
  "spawns",
  "loot",
  "locks",
  "hazards",
  "switches",
  "btr",
];

export const GROUP_LABELS: Record<GroupId, string> = {
  extracts: "Extracts",
  spawns: "Spawns",
  loot: "Containers",
  locks: "Locks",
  hazards: "Hazards",
  switches: "Switches",
  btr: "BTR",
};

export const CATEGORY_LABELS: Record<string, string> = {
  "extracts/pmc": "PMC Extracts",
  "extracts/scav": "SCAV Extracts",
  "extracts/shared": "Co-op Extracts",
  "extracts/transit": "Transit Zones",
  "spawns/pmc": "PMC",
  "spawns/scav": "Scav",
  "spawns/boss": "Boss",
  "spawns/sniper": "Sniper",
  "locks/door": "Doors",
  "locks/container": "Containers",
  "locks/trunk": "Trunks",
  "switches/switch": "Switches",
  "btr/stop": "BTR stops",
};

export interface MapPoint {
  id: string;
  group: GroupId;
  category: string;
  name: string;
  mapKey: string;
  x: number;
  y: number;
  z: number;
}

export function filterKey(p: { group: string; category: string }): string {
  return `${p.group}/${p.category}`;
}

function spawnCategory(spawn: { sides: string[]; categories: string[] }): string {
  if (spawn.categories.includes("boss")) return "boss";
  if (spawn.categories.includes("sniper")) return "sniper";
  if (spawn.sides.length === 1 && spawn.sides[0] === "scav") return "scav";
  return "pmc";
}

function push(
  out: MapPoint[],
  mapKey: string,
  group: GroupId,
  category: string,
  name: string,
  id: string,
  position: Vec3 | null,
): void {
  if (!position) return;
  out.push({ id, group, category, name, mapKey, x: position.x, y: position.y, z: position.z });
}

function pointsForMap(m: MapInfo, out: MapPoint[]): void {
  const key = m.normalizedName;
  for (const e of m.extracts ?? []) {
    push(out, key, "extracts", e.faction, e.name, e.id, e.position);
  }
  (m.transits ?? []).forEach((t, i) => {
    push(out, key, "extracts", "transit", t.description, t.id || `extracts/transit/${i}`, t.position);
  });
  (m.spawns ?? []).forEach((s, i) => {
    const category = spawnCategory(s);
    push(out, key, "spawns", category, s.zoneName ?? "Spawn", `spawns/${category}/${i}`, s.position);
  });
  (m.lootContainers ?? []).forEach((c, i) => {
    const category = c.lootContainer.normalizedName;
    push(out, key, "loot", category, c.lootContainer.name, `loot/${category}/${i}`, c.position);
  });
  (m.locks ?? []).forEach((l, i) => {
    push(
      out,
      key,
      "locks",
      l.lockType,
      l.key?.name ?? `Locked ${l.lockType}`,
      `locks/${l.lockType}/${i}`,
      l.position,
    );
  });
  (m.hazards ?? []).forEach((h, i) => {
    push(out, key, "hazards", h.hazardType, h.name, `hazards/${h.hazardType}/${i}`, h.position);
  });
  (m.switches ?? []).forEach((s, i) => {
    push(out, key, "switches", "switch", s.name, s.id || `switches/switch/${i}`, s.position);
  });
  (m.btrStations ?? []).forEach((b, i) => {
    push(out, key, "btr", "stop", b.name, b.id || `btr/stop/${i}`, b.position);
  });
}

export function extractPoints(data: QuestData): MapPoint[] {
  const out: MapPoint[] = [];
  for (const m of data.maps) pointsForMap(m, out);
  return out;
}

/** Label for a category key: CATEGORY_LABELS, else the name of the first point with that key, else the slug. */
export function categoryLabel(key: string, points: MapPoint[]): string {
  const fixed = CATEGORY_LABELS[key];
  if (fixed) return fixed;
  const hit = points.find((p) => filterKey(p) === key);
  if (hit) return hit.name;
  return key.slice(key.indexOf("/") + 1);
}

import { primaryMapKey } from "../map/mapsData";
import { questCategory, type QuestCategory } from "./questLayer";
import type { QuestData } from "./types";

export interface QuestMarker {
  id: string;
  taskId: string;
  taskName: string;
  trader: string;
  minLevel: number;
  objectiveType: string;
  category: QuestCategory;
  description: string;
  /** Name of the quest item this marker is a spawn point of; unset for zone markers. */
  itemName?: string;
  mapKey: string;
  x: number;
  y: number;
  z: number;
  /** Footprint corners as [x, z]; drawn as a translucent polygon when present. */
  outline?: [number, number][];
  /** Vertical span of the zone; defaults to y when tarkov.dev gives none. */
  top: number;
  bottom: number;
}

/** tarkov.dev map id -> the app's map key; its variants (Night Factory, Ground Zero 21+) fold into the main map. */
function mapKeysById(data: QuestData): Map<string, string> {
  return new Map(data.maps.map((m) => [m.id, primaryMapKey(m.normalizedName)]));
}

export function extractQuestMarkers(data: QuestData): QuestMarker[] {
  const keys = mapKeysById(data);
  const out: QuestMarker[] = [];
  for (const task of data.tasks) {
    for (const obj of task.objectives) {
      // tarkov.dev lists a zone once per variant (Factory and Night Factory); folded onto one map, that
      // is one place, drawn once.
      const placed = new Set<string>();
      const fresh = (mapKey: string, p: { x: number; y: number; z: number }): boolean => {
        const key = `${mapKey}|${p.x}|${p.y}|${p.z}`;
        if (placed.has(key)) return false;
        placed.add(key);
        return true;
      };
      for (const zone of obj.zones ?? []) {
        const mapKey = keys.get(zone.map.id);
        if (!mapKey || !zone.position || !fresh(mapKey, zone.position)) continue;
        out.push({
          id: zone.id,
          taskId: task.id,
          taskName: task.name,
          trader: task.trader.name,
          minLevel: task.minPlayerLevel,
          objectiveType: obj.type,
          category: questCategory(obj.type),
          description: obj.description,
          mapKey,
          x: zone.position.x,
          y: zone.position.y,
          z: zone.position.z,
          outline: zone.outline,
          top: zone.top ?? zone.position.y,
          bottom: zone.bottom ?? zone.position.y,
        });
      }
      // Quest item spawn points, one marker per position, as tarkov.dev's "quest_item" layer draws them.
      for (const loc of obj.locations ?? []) {
        const mapKey = keys.get(loc.map.id);
        if (!mapKey) continue;
        loc.positions.forEach((p, i) => {
          if (!fresh(mapKey, p)) return;
          out.push({
            id: `${obj.id}/${loc.map.id}/${i}`,
            taskId: task.id,
            taskName: task.name,
            trader: task.trader.name,
            minLevel: task.minPlayerLevel,
            objectiveType: obj.type,
            category: questCategory(obj.type),
            description: obj.description,
            itemName: obj.questItem?.name,
            mapKey,
            x: p.x,
            y: p.y,
            z: p.z,
            top: p.y,
            bottom: p.y,
          });
        });
      }
    }
  }
  return out;
}

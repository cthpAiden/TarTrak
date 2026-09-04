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
  mapKey: string;
  x: number;
  y: number;
  z: number;
}

function mapKeysById(data: QuestData): Map<string, string> {
  return new Map(data.maps.map((m) => [m.id, m.normalizedName]));
}

export function extractQuestMarkers(data: QuestData): QuestMarker[] {
  const keys = mapKeysById(data);
  const out: QuestMarker[] = [];
  for (const task of data.tasks) {
    for (const obj of task.objectives) {
      for (const zone of obj.zones ?? []) {
        const mapKey = keys.get(zone.map.id);
        if (!mapKey || !zone.position) continue;
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
        });
      }
    }
  }
  return out;
}

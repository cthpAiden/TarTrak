// Adapter for the static json.tarkov.dev files: raw records keyed by id, with every
// user-facing string held as a translation key that the matching `*_en` file resolves.
import { QUEST_SCHEMA_VERSION } from "./types.ts";
import type {
  MapBtrStation,
  MapExtract,
  MapHazard,
  MapInfo,
  MapLock,
  MapLootContainer,
  MapLootLoose,
  MapSpawn,
  MapSwitch,
  MapTransit,
  QuestData,
  QuestTask,
  TaskObjective,
  TaskZone,
  Vec3,
} from "./types.ts";

export const JSON_TARKOV_DEV = "https://json.tarkov.dev/regular";
export const JSON_FILES = ["maps", "maps_en", "tasks", "tasks_en", "traders", "traders_en"] as const;

export interface RawBundle {
  maps: unknown;
  mapsEn: unknown;
  tasks: unknown;
  tasksEn: unknown;
  traders: unknown;
  tradersEn: unknown;
}

/** `en[key]` when it is a non-empty string, else `key` itself. */
export function tr(en: Record<string, unknown>, key: string): string {
  const value = en[key];
  return typeof value === "string" && value !== "" ? value : key;
}

type Dict = Record<string, unknown>;

function dict(value: unknown): Dict {
  return value && typeof value === "object" ? (value as Dict) : {};
}

function need(value: unknown, path: string): Dict {
  if (!value || typeof value !== "object") throw new Error(`json.tarkov.dev: missing ${path}`);
  return value as Dict;
}

function en(value: unknown): Record<string, unknown> {
  return dict(dict(value).data);
}

function list(value: unknown): Dict[] {
  return Array.isArray(value) ? (value as Dict[]) : [];
}

function pos(value: unknown): Vec3 | null {
  const p = value as Vec3 | undefined;
  return p && typeof p.x === "number" ? { x: p.x, y: p.y, z: p.z } : null;
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function toObjective(o: Dict, tasksEn: Record<string, unknown>, taskMap: string | null): TaskObjective {
  const zones: TaskZone[] = list(o.zones).map((z) => ({
    id: str(z.id),
    map: { id: str(z.map) },
    position: pos(z.position) ?? { x: 0, y: 0, z: 0 },
  }));
  const zoneMaps = [...new Set(zones.map((z) => z.map.id))].map((id) => ({ id }));
  const maps = zoneMaps.length > 0 ? zoneMaps : taskMap ? [{ id: taskMap }] : [];
  return { id: str(o.id), type: str(o.type), description: tr(tasksEn, str(o.description)), maps, zones };
}

function toTask(t: Dict, tasksEn: Record<string, unknown>, traders: Dict, tradersEn: Record<string, unknown>): QuestTask {
  const traderId = str(t.trader);
  const traderKey = str(dict(traders[traderId]).name, traderId);
  const taskMap = typeof t.map === "string" ? t.map : null;
  return {
    id: str(t.id),
    name: tr(tasksEn, str(t.name)),
    trader: { name: tr(tradersEn, traderKey) },
    minPlayerLevel: typeof t.minPlayerLevel === "number" ? t.minPlayerLevel : 0,
    objectives: list(t.objectives).map((o) => toObjective(o, tasksEn, taskMap)),
  };
}

function toMap(m: Dict, mapsEn: Record<string, unknown>, containers: Dict): MapInfo {
  const extracts: MapExtract[] = list(m.extracts).map((e) => ({
    id: str(e.id),
    name: str(e.name),
    faction: str(e.faction),
    position: pos(e.position),
  }));
  const transits: MapTransit[] = list(m.transits).map((t) => ({
    id: str(t.id),
    description: tr(mapsEn, str(t.description)),
    position: pos(t.position),
  }));
  const spawns: MapSpawn[] = list(m.spawns).map((s) => ({
    zoneName: typeof s.zoneName === "string" ? s.zoneName : null,
    position: pos(s.position),
    sides: strings(s.sides),
    categories: strings(s.categories),
  }));
  const lootContainers: MapLootContainer[] = list(m.lootContainers).map((c) => {
    const id = str(c.lootContainer);
    const container = dict(containers[id]);
    return {
      lootContainer: {
        id,
        name: tr(mapsEn, str(container.name, id)),
        normalizedName: str(container.normalizedName, id),
      },
      position: pos(c.position),
    };
  });
  const lootLoose: MapLootLoose[] = list(m.lootLoose).map((l) => ({ position: pos(l.position), items: strings(l.items) }));
  const locks: MapLock[] = list(m.locks).map((l) => ({
    lockType: str(l.lockType),
    key: typeof l.key === "string" ? l.key : null,
    position: pos(l.position),
  }));
  const hazards: MapHazard[] = list(m.hazards).map((h) => ({
    hazardType: str(h.hazardType),
    name: tr(mapsEn, str(h.name)),
    position: pos(h.position),
  }));
  const switches: MapSwitch[] = list(m.switches).map((s) => ({ id: str(s.id), name: str(s.name), position: pos(s.position) }));
  const btrStations: MapBtrStation[] = list(m.btrStops).map((b) => ({
    id: str(b.name),
    name: tr(mapsEn, str(b.name)),
    position: { x: b.x as number, y: b.y as number, z: b.z as number },
  }));
  return {
    id: str(m.id),
    name: tr(mapsEn, str(m.name)),
    normalizedName: str(m.normalizedName),
    extracts,
    transits,
    spawns,
    lootContainers,
    lootLoose,
    locks,
    hazards,
    switches,
    btrStations,
  };
}

export function toQuestData(raw: RawBundle, now: number): QuestData {
  const mapsData = need(dict(raw.maps).data, "maps.data");
  const rawMaps = need(mapsData.maps, "maps.data.maps");
  const containers = dict(mapsData.lootContainers);
  const rawTasks = need(need(dict(raw.tasks).data, "tasks.data").tasks, "tasks.data.tasks");
  const traders = need(dict(raw.traders).data, "traders.data");
  const mapsEn = en(raw.mapsEn);
  const tasksEn = en(raw.tasksEn);
  const tradersEn = en(raw.tradersEn);
  return {
    schemaVersion: QUEST_SCHEMA_VERSION,
    tasks: Object.values(rawTasks).map((t) => toTask(dict(t), tasksEn, traders, tradersEn)),
    maps: Object.values(rawMaps).map((m) => toMap(dict(m), mapsEn, containers)),
    fetchedAt: now,
  };
}

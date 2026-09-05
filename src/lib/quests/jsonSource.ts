// Adapter for the static json.tarkov.dev files: raw records keyed by id, with every
// user-facing string held as a translation key that the matching `*_en` file resolves.
import { QUEST_SCHEMA_VERSION } from "./types.ts";
import type {
  Footprint,
  MapBoss,
  MapBtrStation,
  MapExtract,
  MapHazard,
  MapInfo,
  MapLock,
  MapLootContainer,
  MapLootLoose,
  MapSpawn,
  MapStationaryWeapon,
  MapSwitch,
  MapTransit,
  QuestData,
  QuestTask,
  TaskObjective,
  TaskZone,
  QuestItemLocation,
  Vec3,
} from "./types.ts";

/** tarkov.dev publishes one data set per game mode; "regular" is PvP. */
export type GameMode = "regular" | "pve";
export const GAME_MODES: readonly GameMode[] = ["regular", "pve"];
export const GAME_MODE_LABELS: Record<GameMode, string> = { regular: "PvP", pve: "PvE" };
export const JSON_TARKOV_DEV_BASE = "https://json.tarkov.dev";
/** The PvP data set, kept for the snapshot script and as the default. */
export const JSON_TARKOV_DEV = `${JSON_TARKOV_DEV_BASE}/regular`;
export function jsonUrl(mode: GameMode, file: string): string {
  return `${JSON_TARKOV_DEV_BASE}/${mode}/${file}`;
}
export const JSON_FILES = ["maps", "maps_en", "tasks", "tasks_en", "traders", "traders_en", "items_en"] as const;

export interface RawBundle {
  maps: unknown;
  mapsEn: unknown;
  tasks: unknown;
  tasksEn: unknown;
  traders: unknown;
  tradersEn: unknown;
  itemsEn: unknown;
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

function num(value: unknown, fallback = 0): number {
  return typeof value === "number" ? value : fallback;
}

/** Item display name: items_en, then maps_en (which holds the stationary guns), else the id. */
function itemName(itemsEn: Record<string, unknown>, mapsEn: Record<string, unknown>, id: string): string {
  const key = `${id} Name`;
  for (const source of [itemsEn, mapsEn]) {
    const value = source[key];
    if (typeof value === "string" && value !== "") return value;
  }
  return id;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

/** Outline and height span of anything that has them; only the fields present are set. */
function footprint(o: Dict): Footprint {
  const outline = list(o.outline)
    .map((c) => pos(c))
    .filter((c): c is Vec3 => c !== null)
    .map((c): [number, number] => [c.x, c.z]);
  const f: Footprint = {};
  if (outline.length >= 3) f.outline = outline;
  if (typeof o.top === "number") f.top = o.top;
  // tarkov.dev's artillery zones spell it "botom".
  const bottom = typeof o.bottom === "number" ? o.bottom : o.botom;
  if (typeof bottom === "number") f.bottom = bottom;
  return f;
}

function toObjective(o: Dict, tasksEn: Record<string, unknown>, taskMap: string | null, questItems: Dict): TaskObjective {
  const zones: TaskZone[] = list(o.zones).map((z) => ({
    id: str(z.id),
    map: { id: str(z.map) },
    position: pos(z.position) ?? { x: 0, y: 0, z: 0 },
    ...footprint(z),
  }));
  // Quest item spawn points; a map entry with no positions has nothing to draw and is dropped.
  const locations: QuestItemLocation[] = list(o.possibleLocations)
    .map((l) => ({ map: { id: str(l.map) }, positions: list(l.positions).map(pos).filter((p): p is Vec3 => p !== null) }))
    .filter((l) => l.map.id !== "" && l.positions.length > 0);
  const placedMaps = [...new Set([...zones.map((z) => z.map.id), ...locations.map((l) => l.map.id)])].map((id) => ({ id }));
  const maps = placedMaps.length > 0 ? placedMaps : taskMap ? [{ id: taskMap }] : [];
  const out: TaskObjective = { id: str(o.id), type: str(o.type), description: tr(tasksEn, str(o.description)), maps, zones };
  if (locations.length > 0) out.locations = locations;
  if (typeof o.questItem === "string") {
    out.questItem = { id: o.questItem, name: tr(tasksEn, str(dict(questItems[o.questItem]).name, `${o.questItem} Name`)) };
  }
  return out;
}

function toTask(
  t: Dict,
  tasksEn: Record<string, unknown>,
  traders: Dict,
  tradersEn: Record<string, unknown>,
  itemsEn: Record<string, unknown>,
  mapsEn: Record<string, unknown>,
  questItems: Dict,
): QuestTask {
  const traderId = str(t.trader);
  const traderKey = str(dict(traders[traderId]).name, traderId);
  const taskMap = typeof t.map === "string" ? t.map : null;
  // Only a "complete" requirement gates the task; "started" or "failed" ones are alternative paths.
  const requires = list(t.taskRequirements)
    .filter((r) => strings(r.status).includes("complete") && typeof r.task === "string")
    .map((r) => r.task as string);
  return {
    id: str(t.id),
    name: tr(tasksEn, str(t.name)),
    trader: { name: tr(tradersEn, traderKey) },
    minPlayerLevel: typeof t.minPlayerLevel === "number" ? t.minPlayerLevel : 0,
    objectives: list(t.objectives).map((o) => toObjective(o, tasksEn, taskMap, questItems)),
    requires,
    kappaRequired: t.kappaRequired === true,
    lightkeeperRequired: t.lightkeeperRequired === true,
    // Only http(s) links may ever be handed to the system browser.
    wikiLink: /^https?:\/\//.test(str(t.wikiLink)) ? str(t.wikiLink) : undefined,
    neededKeys: [...new Set(list(t.neededKeys).flatMap((k) => strings(k.keys)).map((id) => itemName(itemsEn, mapsEn, id)))],
  };
}

function toMap(
  m: Dict,
  mapsEn: Record<string, unknown>,
  itemsEn: Record<string, unknown>,
  containers: Dict,
  mobs: Dict,
): MapInfo {
  const switchNames = new Map(list(m.switches).map((sw) => [str(sw.id), tr(mapsEn, str(sw.name))]));
  const extracts: MapExtract[] = list(m.extracts).map((e) => {
    const out: MapExtract = {
      id: str(e.id),
      name: tr(mapsEn, str(e.name)),
      faction: str(e.faction),
      position: pos(e.position),
      ...footprint(e),
    };
    const switches = strings(e.switches).map((id) => switchNames.get(id) ?? id);
    if (switches.length > 0) out.switches = switches;
    const transfer = dict(e.transferItem);
    if (typeof transfer.item === "string") {
      out.requiredItem = { name: itemName(itemsEn, mapsEn, transfer.item), count: num(transfer.count, 1) };
    }
    return out;
  });
  const transits: MapTransit[] = list(m.transits).map((t) => {
    const out: MapTransit = {
      id: str(t.id),
      description: tr(mapsEn, str(t.description)),
      position: pos(t.position),
      ...footprint(t),
    };
    if (typeof t.conditions === "string" && t.conditions !== "") out.conditions = tr(mapsEn, t.conditions);
    return out;
  });
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
  const lootLoose: MapLootLoose[] = list(m.lootLoose).map((l) => ({
    position: pos(l.position),
    items: [...new Set(strings(l.items).map((id) => itemName(itemsEn, mapsEn, id)))],
  }));
  const locks: MapLock[] = list(m.locks).map((l) => {
    const lock: MapLock = {
      lockType: str(l.lockType),
      key: typeof l.key === "string" ? itemName(itemsEn, mapsEn, l.key) : null,
      position: pos(l.position),
    };
    if (l.needsPower === true) lock.needsPower = true;
    return lock;
  });
  const hazards: MapHazard[] = [
    ...list(m.hazards).map((h) => ({
      hazardType: str(h.hazardType),
      name: tr(mapsEn, str(h.name)),
      position: pos(h.position),
      ...footprint(h),
    })),
    // Artillery zones are a separate map field on tarkov.dev; its map draws them as "Mortar" hazards.
    ...list(dict(m.artillery).zones).map((z) => ({
      hazardType: "mortar",
      name: "Mortar",
      position: pos(z.position),
      ...footprint(z),
    })),
  ];
  const extractNames = new Map(list(m.extracts).map((e) => [str(e.id), tr(mapsEn, str(e.name))]));
  const switches: MapSwitch[] = list(m.switches).map((s) => {
    const out: MapSwitch = { id: str(s.id), name: tr(mapsEn, str(s.name)), position: pos(s.position) };
    const activates = list(s.activates).flatMap((a) => {
      const target =
        typeof a.extract === "string" ? extractNames.get(a.extract) : typeof a.switch === "string" ? switchNames.get(a.switch) : undefined;
      return target ? [{ operation: str(a.operation, "Unlock"), target }] : [];
    });
    if (activates.length > 0) out.activates = activates;
    return out;
  });
  const btrStations: MapBtrStation[] = list(m.btrStops).map((b) => ({
    id: str(b.name),
    name: tr(mapsEn, str(b.name)),
    position: { x: b.x as number, y: b.y as number, z: b.z as number },
  }));
  const bosses: MapBoss[] = list(m.bosses).map((b) => {
    const mob = dict(mobs[str(b.mob)]);
    return {
      name: tr(mapsEn, str(mob.name, str(b.mob))),
      normalizedName: str(mob.normalizedName, str(b.mob)),
      spawnChance: num(b.spawnChance),
      spawnKeys: [...new Set(list(b.spawnLocations).map((sl) => str(sl.spawnKey)))],
    };
  });
  const stationaryWeapons: MapStationaryWeapon[] = list(m.stationaryWeapons).map((w) => {
    const id = str(w.stationaryWeapon);
    return { id, name: itemName(itemsEn, mapsEn, id), position: pos(w.position) };
  });
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
    bosses,
    stationaryWeapons,
  };
}

export function toQuestData(raw: RawBundle, now: number): QuestData {
  const mapsData = need(dict(raw.maps).data, "maps.data");
  const rawMaps = need(mapsData.maps, "maps.data.maps");
  const containers = dict(mapsData.lootContainers);
  const mobs = dict(mapsData.mobs);
  const tasksData = need(dict(raw.tasks).data, "tasks.data");
  const rawTasks = need(tasksData.tasks, "tasks.data.tasks");
  const questItems = dict(tasksData.questItems);
  const traders = need(dict(raw.traders).data, "traders.data");
  const mapsEn = en(raw.mapsEn);
  const tasksEn = en(raw.tasksEn);
  const tradersEn = en(raw.tradersEn);
  const itemsEn = en(raw.itemsEn);
  return {
    schemaVersion: QUEST_SCHEMA_VERSION,
    tasks: Object.values(rawTasks).map((t) => toTask(dict(t), tasksEn, traders, tradersEn, itemsEn, mapsEn, questItems)),
    maps: Object.values(rawMaps).map((m) => toMap(dict(m), mapsEn, itemsEn, containers, mobs)),
    fetchedAt: now,
  };
}

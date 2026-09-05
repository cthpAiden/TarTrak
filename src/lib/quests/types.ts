export const QUEST_SCHEMA_VERSION = 5;

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}
export interface TaskZone {
  id: string;
  map: { id: string };
  position: Vec3;
}
export interface TaskObjective {
  id: string;
  type: string;
  description: string;
  maps: { id: string }[];
  zones?: TaskZone[];
}
export interface QuestTask {
  id: string;
  name: string;
  trader: { name: string };
  minPlayerLevel: number;
  objectives: TaskObjective[];
  /** Ids of tasks that must be complete before this one unlocks. */
  requires?: string[];
  kappaRequired?: boolean;
  lightkeeperRequired?: boolean;
}
export interface MapExtract {
  id: string;
  name: string;
  faction: string;
  position: Vec3 | null;
}
export interface MapTransit {
  id: string;
  description: string;
  position: Vec3 | null;
}
export interface MapSpawn {
  zoneName: string | null;
  position: Vec3 | null;
  sides: string[];
  categories: string[];
}
export interface MapLootContainer {
  lootContainer: { id: string; name: string; normalizedName: string };
  position: Vec3 | null;
}
export interface MapLootLoose {
  position: Vec3 | null;
  /** Item names, deduplicated, in source order. */
  items: string[];
}
export interface MapLock {
  lockType: string;
  /** Name of the key that opens it, null when the lock needs none. */
  key: string | null;
  position: Vec3 | null;
}
export interface MapHazard {
  hazardType: string;
  name: string;
  position: Vec3 | null;
}
export interface MapSwitch {
  id: string;
  name: string;
  position: Vec3 | null;
}
export interface MapBoss {
  name: string;
  normalizedName: string;
  spawnChance: number;
  spawnKeys: string[];
}
export interface MapStationaryWeapon {
  id: string;
  name: string;
  position: Vec3 | null;
}
export interface MapBtrStation {
  id: string;
  name: string;
  position: Vec3 | null;
}
export interface MapInfo {
  id: string;
  name: string;
  normalizedName: string;
  extracts: MapExtract[];
  transits?: MapTransit[] | null;
  spawns?: MapSpawn[] | null;
  lootContainers?: MapLootContainer[] | null;
  lootLoose?: MapLootLoose[] | null;
  locks?: MapLock[] | null;
  hazards?: MapHazard[] | null;
  switches?: MapSwitch[] | null;
  btrStations?: MapBtrStation[] | null;
  bosses?: MapBoss[] | null;
  stationaryWeapons?: MapStationaryWeapon[] | null;
}
export interface QuestData {
  schemaVersion: number;
  tasks: QuestTask[];
  maps: MapInfo[];
  fetchedAt: number;
}

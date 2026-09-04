export const QUEST_SCHEMA_VERSION = 3;

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
  items: string[];
}
export interface MapLock {
  lockType: string;
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
}
export interface QuestData {
  schemaVersion: number;
  tasks: QuestTask[];
  maps: MapInfo[];
  fetchedAt: number;
}

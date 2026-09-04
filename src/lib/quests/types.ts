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
export interface MapInfo {
  id: string;
  name: string;
  normalizedName: string;
  extracts: MapExtract[];
}
export interface QuestData {
  tasks: QuestTask[];
  maps: MapInfo[];
  fetchedAt: number;
}

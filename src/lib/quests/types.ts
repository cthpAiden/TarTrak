export const QUEST_SCHEMA_VERSION = 12;

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}
/** Anything with an area: the corners of its footprint as [x, z] pairs, and the heights it spans. */
export interface Footprint {
  outline?: [number, number][];
  top?: number;
  bottom?: number;
}
export interface TaskZone extends Footprint {
  id: string;
  map: { id: string };
  position: Vec3;
}
/** Where a quest item can spawn on one map (tarkov.dev "possibleLocations"). */
export interface QuestItemLocation {
  map: { id: string };
  positions: Vec3[];
}
export interface TaskObjective {
  id: string;
  type: string;
  description: string;
  maps: { id: string }[];
  zones?: TaskZone[];
  /** Spawn points of the quest item a findQuestItem objective looks for; drawn like tarkov.dev's item markers. */
  locations?: QuestItemLocation[];
  questItem?: { id: string; name: string };
  /** How many: items to find or hand over, kills, uses. */
  count?: number;
  /** The items must be found in raid. */
  foundInRaid?: true;
  /** Not needed to complete the task. */
  optional?: true;
}
/** What finishing a task pays out; only the parts tarkov.dev lists something for are set. */
export interface TaskRewards {
  items?: { name: string; count: number }[];
  /** Trader reputation changes, e.g. Prapor +0.10. */
  standing?: { trader: string; delta: number }[];
  skills?: { name: string; level: number }[];
  /** Number of trader offers and hideout crafts it unlocks. */
  offers?: number;
  crafts?: number;
}
export interface QuestTask {
  id: string;
  name: string;
  /** `id` is tarkov.dev's trader id, the file name of the portrait in public/icons/traders. */
  trader: { id: string; name: string };
  minPlayerLevel: number;
  objectives: TaskObjective[];
  /** Ids of tasks that must be complete before this one unlocks. */
  requires?: string[];
  kappaRequired?: boolean;
  lightkeeperRequired?: boolean;
  wikiLink?: string;
  /** Display names of the keys the task needs, deduplicated. */
  neededKeys?: string[];
  /** "USEC" or "BEAR" when only that faction gets the task; unset for everyone's. */
  faction?: string;
  experience?: number;
  rewards?: TaskRewards;
  /** Trader loyalty levels the task needs before it is offered. */
  traderLevels?: { trader: string; level: number }[];
  /** What fails the task once taken: the names of the tasks whose completion fails it, or the condition text. */
  failsOn?: string[];
}
export interface MapExtract extends Footprint {
  id: string;
  name: string;
  /** tarkov.dev factions: "pmc", "scav", or "shared" (usable by both). */
  faction: string;
  position: Vec3 | null;
  /** Names of the switches that must be flipped before it opens. */
  switches?: string[];
  /** Item handed over to use it: the V-Ex fee, a secret-extract item. `image` is its picture id on tarkov.dev, when it has one. */
  requiredItem?: { name: string; count: number; image?: string };
}
export interface MapTransit extends Footprint {
  id: string;
  description: string;
  position: Vec3 | null;
  /** Access condition, e.g. "TerraGroup Labs access keycard required (1)". */
  conditions?: string;
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
  /** Handbook categories of the items (slugs from data/itemCategories.json), deduplicated; tarkov.dev's loose loot filters. */
  categories?: string[];
  /** Picture id of the one item a single-item spot holds, drawn as its marker like on tarkov.dev. */
  image?: string;
}
export interface MapLock {
  lockType: string;
  /** Name of the key that opens it, null when the lock needs none. */
  key: string | null;
  position: Vec3 | null;
  /** Set when the lock only works while the map's power is on. */
  needsPower?: true;
  /** Picture id of the key on tarkov.dev, for the popup. */
  keyImage?: string;
}
/** Sniper and minefield zones from tarkov.dev's hazards, plus its artillery zones as "mortar". */
export interface MapHazard extends Footprint {
  hazardType: string;
  name: string;
  position: Vec3 | null;
}
export interface MapSwitch {
  id: string;
  name: string;
  position: Vec3 | null;
  /** What flipping it does: operation ("Unlock", "Lock", "Open") and the extract or switch it acts on. */
  activates?: { operation: string; target: string }[];
}
export interface MapBoss {
  name: string;
  normalizedName: string;
  spawnChance: number;
  spawnKeys: string[];
  /** Guards that spawn with it, the most tarkov.dev lists. */
  escorts?: number;
  /** What spawns it when not the raid start, e.g. "Switch". */
  trigger?: string;
  /** tarkov.dev's portrait, an https://assets.tarkov.dev URL. */
  portrait?: string;
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
  /** Raid length in minutes. */
  raidDuration?: number;
  /** Player count range as tarkov.dev writes it, "10-12". */
  players?: string;
  /** Names of the keys or keycards needed to enter (The Lab, Terminal). */
  accessKeys?: string[];
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

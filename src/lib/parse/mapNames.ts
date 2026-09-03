/** Game-internal names (log "Location:" and scene preset names) -> data/maps.json key. */
const MAP_KEYS: Record<string, string> = {
  lighthouse: "lighthouse",
  tarkovstreets: "streets-of-tarkov",
  city: "streets-of-tarkov",
  bigmap: "customs",
  factory4_day: "factory",
  factory4_night: "factory",
  woods: "woods",
  shoreline: "shoreline",
  interchange: "interchange",
  rezervbase: "reserve",
  laboratory: "the-lab",
  sandbox: "ground-zero",
  sandbox_high: "ground-zero",
  labyrinth: "the-labyrinth",
  terminal: "terminal",
};

export function resolveMapKey(logName: string): string | null {
  return MAP_KEYS[logName.toLowerCase()] ?? null;
}

import type { MapLootContainer, QuestData } from "./types";

// JSON.parse allocates a fresh string object for every occurrence of a value, so an item name
// repeated tens of thousands of times across loot spots costs one heap allocation per occurrence,
// and each loot container descriptor ({id, name, normalizedName}) is likewise duplicated per spot.
// Routing repeated strings, and repeated container descriptors, through one pool per load collapses
// them to a single shared instance. This only changes object identity to cut heap use; the data
// itself (what JSON.stringify sees) is unchanged.

/** Mutates `d` in place (the loader owns the freshly parsed object) and returns it. */
export function compactQuestData(d: QuestData): QuestData {
  const seen = new Map<string, string>();
  const pool = (s: string): string => {
    const found = seen.get(s);
    if (found !== undefined) return found;
    seen.set(s, s);
    return s;
  };
  const poolArray = (arr: string[] | undefined): void => {
    if (!arr) return;
    for (let i = 0; i < arr.length; i++) arr[i] = pool(arr[i]);
  };
  const containers = new Map<string, MapLootContainer["lootContainer"]>();

  for (const task of d.tasks) {
    task.trader.id = pool(task.trader.id);
    task.trader.name = pool(task.trader.name);
    for (const obj of task.objectives) {
      obj.type = pool(obj.type);
      for (const m of obj.maps) m.id = pool(m.id);
    }
  }

  for (const map of d.maps) {
    for (const extract of map.extracts) extract.faction = pool(extract.faction);

    for (const spot of map.lootLoose ?? []) {
      poolArray(spot.items);
      poolArray(spot.categories);
      if (spot.image !== undefined) spot.image = pool(spot.image);
    }

    for (const entry of map.lootContainers ?? []) {
      const lc = entry.lootContainer;
      // Keyed on every field, so two ids that ever disagreed on a name would keep their own values.
      const key = `${lc.id}\u0000${lc.name}\u0000${lc.normalizedName}`;
      const existing = containers.get(key);
      if (existing) {
        entry.lootContainer = existing;
      } else {
        lc.id = pool(lc.id);
        lc.name = pool(lc.name);
        lc.normalizedName = pool(lc.normalizedName);
        containers.set(key, lc);
      }
    }

    for (const spawn of map.spawns ?? []) {
      spawn.zoneName = spawn.zoneName === null ? null : pool(spawn.zoneName);
      poolArray(spawn.sides);
      poolArray(spawn.categories);
    }

    for (const hazard of map.hazards ?? []) {
      hazard.hazardType = pool(hazard.hazardType);
      hazard.name = pool(hazard.name);
    }

    for (const lock of map.locks ?? []) {
      lock.lockType = pool(lock.lockType);
      lock.key = lock.key === null ? null : pool(lock.key);
      if (lock.keyImage !== undefined) lock.keyImage = pool(lock.keyImage);
    }
  }

  return d;
}

import type { MapBoss, MapInfo } from "../quests/types";

/** One line of the map card's boss list: a boss tarkov.dev lists for the map, its spawns merged. */
export interface BossSummary {
  name: string;
  /** Percent, the highest of its spawn entries. */
  chance: number;
  escorts?: number;
  /** Set when every one of its spawn entries needs a switch (the Lab's and Reserve's raider waves). */
  bySwitch?: true;
  portrait?: string;
}

/**
 * tarkov.dev lists a boss once per spawn zone (Lighthouse has seven "Rogue" entries with different
 * chances); the card names each boss once, at its best chance, biggest escort, likeliest first.
 */
export function summarizeBosses(bosses: MapBoss[]): BossSummary[] {
  const by = new Map<string, BossSummary & { allSwitch: boolean }>();
  for (const b of bosses) {
    const cur = by.get(b.normalizedName);
    const chance = Math.round(b.spawnChance * 100);
    if (!cur) {
      const entry: BossSummary & { allSwitch: boolean } = { name: b.name, chance, allSwitch: b.trigger === "Switch" };
      if (b.escorts) entry.escorts = b.escorts;
      if (b.portrait) entry.portrait = b.portrait;
      by.set(b.normalizedName, entry);
      continue;
    }
    cur.chance = Math.max(cur.chance, chance);
    if (b.escorts && b.escorts > (cur.escorts ?? 0)) cur.escorts = b.escorts;
    if (!cur.portrait && b.portrait) cur.portrait = b.portrait;
    cur.allSwitch = cur.allSwitch && b.trigger === "Switch";
  }
  return [...by.values()]
    .sort((a, b) => b.chance - a.chance || a.name.localeCompare(b.name))
    .map(({ allSwitch, ...rest }) => (allSwitch ? { ...rest, bySwitch: true } : rest));
}

/** "35 min · 10-12 players", whichever parts tarkov.dev gives. */
export function raidLine(info: Pick<MapInfo, "raidDuration" | "players">): string {
  const parts: string[] = [];
  if (info.raidDuration) parts.push(`${info.raidDuration} min`);
  if (info.players) parts.push(`${info.players} players`);
  return parts.join(" · ");
}

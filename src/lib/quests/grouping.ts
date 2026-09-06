import type { QuestTask } from "./types";

export const TRADER_ORDER: readonly string[] = [
  "Prapor",
  "Therapist",
  "Skier",
  "Peacekeeper",
  "Mechanic",
  "Ragman",
  "Jaeger",
  "Fence",
  "Lightkeeper",
  "Ref",
  "BTR Driver",
];

export interface GroupOpts {
  search: string;
  hideDone: boolean;
  /** Drop tasks whose prerequisite tasks are not all marked done. */
  availableOnly?: boolean;
  kappaOnly?: boolean;
  playerLevel: number;
  done: Record<string, true>;
  countsOnMap: Map<string, number>;
  /** Keep only tasks with at least one marker on the map (a count above zero). */
  onMapOnly?: boolean;
  /** My PMC's faction ("usec" or "bear"): the other side's tasks are dropped. Unset or "any" keeps all. */
  faction?: string;
}

/** A task is for me unless tarkov.dev restricts it to a faction that is not mine. */
export function forFaction(t: QuestTask, faction: string | undefined): boolean {
  if (!t.faction || !faction || faction === "any") return true;
  return t.faction.toLowerCase() === faction.toLowerCase();
}

/** A task is unlocked once every task it requires is done; one with no known requirements always is. */
export function isUnlocked(t: QuestTask, done: Record<string, true>): boolean {
  return (t.requires ?? []).every((id) => done[id]);
}

/** Ids of the tasks still locked behind an unfinished prerequisite. */
export function lockedTaskIds(tasks: QuestTask[], done: Record<string, true>): Set<string> {
  const out = new Set<string>();
  for (const t of tasks) if (!isUnlocked(t, done)) out.add(t.id);
  return out;
}

export interface TraderGroup {
  trader: string;
  done: number;
  total: number;
  tasks: { t: QuestTask; count: number }[];
}

function traderRank(name: string): number {
  const i = TRADER_ORDER.indexOf(name);
  return i === -1 ? TRADER_ORDER.length : i;
}

/** total/done count every task of the trader regardless of search or hideDone; `tasks` is the filtered, sorted list. */
export function groupByTrader(tasks: QuestTask[], opts: GroupOpts): TraderGroup[] {
  const q = opts.search.trim().toLowerCase();
  const groups = new Map<string, TraderGroup>();
  for (const t of tasks) {
    const trader = t.trader.name;
    let g = groups.get(trader);
    if (!g) {
      g = { trader, done: 0, total: 0, tasks: [] };
      groups.set(trader, g);
    }
    g.total++;
    if (opts.done[t.id]) g.done++;
    if (opts.hideDone && opts.done[t.id]) continue;
    if (opts.playerLevel > 0 && t.minPlayerLevel > opts.playerLevel) continue;
    if (opts.kappaOnly && !t.kappaRequired) continue;
    if (!forFaction(t, opts.faction)) continue;
    if (opts.onMapOnly && !(opts.countsOnMap.get(t.id) ?? 0)) continue;
    // A done task stays listed when the user shows done ones, whatever its prerequisites say.
    if (opts.availableOnly && !opts.done[t.id] && !isUnlocked(t, opts.done)) continue;
    if (q && !t.name.toLowerCase().includes(q) && !trader.toLowerCase().includes(q)) continue;
    g.tasks.push({ t, count: opts.countsOnMap.get(t.id) ?? 0 });
  }
  const out = [...groups.values()].filter((g) => g.tasks.length > 0);
  for (const g of out) {
    g.tasks.sort(
      (a, b) =>
        b.count - a.count ||
        a.t.minPlayerLevel - b.t.minPlayerLevel ||
        a.t.name.localeCompare(b.t.name),
    );
  }
  out.sort((a, b) => traderRank(a.trader) - traderRank(b.trader) || a.trader.localeCompare(b.trader));
  return out;
}

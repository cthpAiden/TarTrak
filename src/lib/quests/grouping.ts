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
  playerLevel: number;
  done: Record<string, true>;
  countsOnMap: Map<string, number>;
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

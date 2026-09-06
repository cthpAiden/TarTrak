// Text for the quest panel's expanded rows: what a task wants, what gates it, what it pays.
import type { QuestTask, TaskObjective } from "./types";

/** "Hand over the items ×3 (found in raid) (optional)": the description plus the flags tarkov.dev sets. */
export function objectiveLine(o: TaskObjective): string {
  let s = o.description;
  if (o.count && o.count > 1) s += ` ×${o.count.toLocaleString("en-US")}`;
  if (o.foundInRaid) s += " (found in raid)";
  if (o.optional) s += " (optional)";
  return s;
}

/** True when the task's objectives sit on more than one map, so each line should say where. */
export function spansMaps(t: QuestTask): boolean {
  return new Set(t.objectives.flatMap((o) => o.maps.map((m) => m.id))).size > 1;
}

/**
 * What still stands between me and the task: prerequisite tasks not marked done (by name), trader
 * loyalty levels, and the faction it is limited to. Empty when nothing does.
 */
export function gateLines(t: QuestTask, done: Record<string, true>, nameOf: (taskId: string) => string | undefined): string[] {
  const out: string[] = [];
  const pending = (t.requires ?? []).filter((id) => !done[id]).map((id) => nameOf(id) ?? id);
  if (pending.length > 0) out.push(`after ${pending.join(", ")}`);
  for (const g of t.traderLevels ?? []) out.push(`${g.trader} LL${g.level}`);
  if (t.faction) out.push(`${t.faction} only`);
  return out;
}

/** "+3,000 XP · Roubles ×80,000 · Prapor +0.10 · Surgery +2 · 2 offers · 1 craft", or "" for a task that pays nothing listed. */
export function rewardLine(t: QuestTask): string {
  const parts: string[] = [];
  const n = (v: number) => v.toLocaleString("en-US");
  if (t.experience) parts.push(`+${n(t.experience)} XP`);
  const r = t.rewards;
  for (const i of r?.items ?? []) parts.push(i.count > 1 ? `${i.name} ×${n(i.count)}` : i.name);
  for (const s of r?.standing ?? []) parts.push(`${s.trader} ${s.delta >= 0 ? "+" : "−"}${Math.abs(s.delta).toFixed(2)}`);
  for (const s of r?.skills ?? []) parts.push(`${s.name} +${s.level}`);
  if (r?.offers) parts.push(`${r.offers} ${r.offers === 1 ? "offer" : "offers"}`);
  if (r?.crafts) parts.push(`${r.crafts} ${r.crafts === 1 ? "craft" : "crafts"}`);
  return parts.join(" · ");
}

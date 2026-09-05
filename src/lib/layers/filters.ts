export type Filters = Record<string, boolean>;

/**
 * Keys (group/category) or whole groups that start on. The extracts group is on as a whole so a
 * faction tarkov.dev adds later is never hidden by default; only Scav extracts start off.
 */
export const DEFAULT_ON: ReadonlySet<string> = new Set([
  "labels/landmark",
  "extracts",
  "quests/visit",
  "quests/questItem",
  "quests/mark",
  "quests/item",
  "quests/other",
]);

export const FILTER_KEY_RE = /^[a-z]+(\/[a-z0-9_-]+)?$/i;

const DEFAULT_OFF: ReadonlySet<string> = new Set(["extracts/scav"]);

export function isOn(f: Filters, group: string, category: string): boolean {
  const key = `${group}/${category}`;
  if (typeof f[key] === "boolean") return f[key];
  if (typeof f[group] === "boolean") return f[group];
  if (DEFAULT_OFF.has(key)) return false;
  return DEFAULT_ON.has(key) || DEFAULT_ON.has(group);
}

export type GroupState = "all" | "none" | "some";

export function groupState(f: Filters, group: string, categories: readonly string[]): GroupState {
  if (categories.length === 0) return f[group] === true ? "all" : "none";
  let on = 0;
  for (const c of categories) if (isOn(f, group, c)) on++;
  if (on === 0) return "none";
  if (on === categories.length) return "all";
  return "some";
}

export function setGroup(f: Filters, group: string, on: boolean): Filters {
  const out: Filters = {};
  const prefix = `${group}/`;
  for (const [k, v] of Object.entries(f)) {
    if (k === group || k.startsWith(prefix)) continue;
    out[k] = v;
  }
  out[group] = on;
  return out;
}

export function setCategory(f: Filters, group: string, category: string, on: boolean): Filters {
  return { ...f, [`${group}/${category}`]: on };
}

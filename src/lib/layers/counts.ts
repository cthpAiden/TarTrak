import { QUEST_CATEGORIES, QUEST_CATEGORY_LABELS } from "../quests/questLayer";
import type { QuestMarker } from "../quests/markers";
import { isOn, groupState, type Filters, type GroupState } from "./filters";
import { categoryLabel, GROUP_LABELS, GROUP_ORDER, type MapPoint } from "./points";

export interface CategoryCount {
  key: string;
  group: string;
  category: string;
  label: string;
  total: number;
  shown: number;
}

export interface GroupCount {
  group: string;
  label: string;
  state: GroupState;
  total: number;
  shown: number;
  categories: CategoryCount[];
}

/** GROUP_ORDER with the quest markers inserted as a pseudo-group right after extracts. */
/** "labels" and "quests" are pseudo-groups: not MapPoints, but they share the filter tree. */
const PANEL_GROUPS: readonly string[] = ["labels", GROUP_ORDER[0], "quests", ...GROUP_ORDER.slice(1)];

const PANEL_LABELS: Record<string, string> = { ...GROUP_LABELS, labels: "Map Labels", quests: "Map Tasks" };

function group(
  g: string,
  categories: { category: string; label: string; total: number }[],
  filters: Filters,
): GroupCount {
  let total = 0;
  let shown = 0;
  const out: CategoryCount[] = categories.map((c) => {
    const on = isOn(filters, g, c.category);
    total += c.total;
    if (on) shown += c.total;
    return { key: `${g}/${c.category}`, group: g, category: c.category, label: c.label, total: c.total, shown: on ? c.total : 0 };
  });
  return {
    group: g,
    label: PANEL_LABELS[g] ?? g,
    state: groupState(filters, g, out.map((c) => c.category)),
    total,
    shown,
    categories: out,
  };
}

/**
 * Per-map counts for the filter panel. Inputs are already limited to the current map, and
 * `mapQuestMarkers` must not be filtered by layer toggles or `shown` could never differ from `total`.
 */
export function buildCounts(
  mapPoints: MapPoint[],
  mapQuestMarkers: QuestMarker[],
  filters: Filters,
  labelCount = 0,
): GroupCount[] {
  const pointTotals = new Map<string, number>();
  for (const p of mapPoints) {
    for (const c of p.categories ?? [p.category]) {
      const key = `${p.group}/${c}`;
      pointTotals.set(key, (pointTotals.get(key) ?? 0) + 1);
    }
  }
  const questTotals = new Map<string, number>();
  for (const m of mapQuestMarkers) questTotals.set(m.category, (questTotals.get(m.category) ?? 0) + 1);

  return PANEL_GROUPS.map((g) => {
    if (g === "labels") {
      return group(g, [{ category: "landmark", label: "Landmark labels", total: labelCount }], filters);
    }
    if (g === "quests") {
      return group(
        g,
        QUEST_CATEGORIES.map((c) => ({
          category: c,
          label: QUEST_CATEGORY_LABELS[c],
          total: questTotals.get(c) ?? 0,
        })),
        filters,
      );
    }
    const categories = [...pointTotals]
      .filter(([key]) => key.startsWith(`${g}/`))
      .map(([key, total]) => ({ category: key.slice(g.length + 1), label: categoryLabel(key, mapPoints), total }))
      .sort((a, b) => a.label.localeCompare(b.label));
    return group(g, categories, filters);
  });
}

import L from "leaflet";
import type { QuestMarker } from "./markers";

const ITEM_TYPES = new Set(["findItem", "giveItem", "plantItem", "plantQuestItem", "giveQuestItem", "buildWeapon", "sellItem"]);

export type QuestCategory = "visit" | "questItem" | "mark" | "item" | "other";

export const QUEST_CATEGORIES: readonly QuestCategory[] = ["visit", "questItem", "mark", "item", "other"];

export const QUEST_CATEGORY_LABELS: Record<QuestCategory, string> = {
  visit: "Visit",
  questItem: "Quest items",
  mark: "Mark",
  item: "Items",
  other: "Other",
};

export function questCategory(objectiveType: string): QuestCategory {
  if (objectiveType === "visit") return "visit";
  if (objectiveType === "findQuestItem") return "questItem";
  if (objectiveType === "mark") return "mark";
  if (ITEM_TYPES.has(objectiveType)) return "item";
  return "other";
}

/** tarkov.dev draws two quest icons: one for quest items, one for every other objective. */
export function questIconFile(category: QuestCategory): string {
  return category === "questItem" || category === "item" ? "quest_item" : "quest_objective";
}

export function questIconUrl(category: QuestCategory): string {
  return `/icons/${questIconFile(category)}.png`;
}

export function visibleQuestMarkers(
  all: QuestMarker[],
  mapKey: string,
  done: Record<string, true>,
  playerLevel: number,
): QuestMarker[] {
  return all.filter(
    (m) => m.mapKey === mapKey && !done[m.taskId] && (playerLevel <= 0 || m.minLevel <= playerLevel),
  );
}

/** Leaflet renders string popups and tooltips as HTML, so remote names must be escaped. */
export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** 24px image marker, the same size and drop shadow as the other point markers. */
export function questIcon(m: QuestMarker): L.Icon {
  return L.icon({
    iconUrl: questIconUrl(m.category),
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
    className: `point-icon quest-icon quests ${m.category}`,
  });
}

export function questPopupHtml(m: QuestMarker): string {
  return `<b>${esc(m.taskName)}</b><br><small>${esc(m.trader)} · lvl ${m.minLevel}</small><br>${esc(m.description)}`;
}

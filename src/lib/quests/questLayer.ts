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

const GLYPHS: Record<QuestCategory, string> = {
  visit: "◎",
  questItem: "★",
  mark: "⚑",
  item: "▣",
  other: "•",
};

export function iconFor(objectiveType: string): string {
  return GLYPHS[questCategory(objectiveType)];
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

export function questDivIcon(m: QuestMarker): L.DivIcon {
  return L.divIcon({
    className: "quest-icon",
    html: `<span title="${esc(m.taskName)}">${iconFor(m.objectiveType)}</span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

export function questPopupHtml(m: QuestMarker): string {
  return `<b>${esc(m.taskName)}</b><br><small>${esc(m.trader)} · lvl ${m.minLevel}</small><br>${esc(m.description)}`;
}

import L from "leaflet";
import type { ExtractMarker, QuestMarker } from "./markers";

const ITEM_TYPES = new Set(["findItem", "giveItem", "plantItem", "plantQuestItem", "giveQuestItem", "buildWeapon", "sellItem"]);

export function iconFor(objectiveType: string): string {
  if (objectiveType === "visit") return "◎";
  if (objectiveType === "findQuestItem") return "★";
  if (objectiveType === "mark") return "⚑";
  if (ITEM_TYPES.has(objectiveType)) return "▣";
  return "•";
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

function esc(s: string): string {
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

export function extractDivIcon(e: ExtractMarker): L.DivIcon {
  return L.divIcon({
    className: `extract-icon ${e.faction}`,
    html: `<span title="${esc(e.name)}">⇲</span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

export function questPopupHtml(m: QuestMarker): string {
  return `<b>${esc(m.taskName)}</b><br><small>${esc(m.trader)} · lvl ${m.minLevel}</small><br>${esc(m.description)}`;
}

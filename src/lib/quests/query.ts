import { fetch } from "@tauri-apps/plugin-http";
import { JSON_FILES, jsonUrl, toQuestData, type GameMode, type RawBundle } from "./jsonSource";
import type { QuestData } from "./types";

async function defaultGet(url: string): Promise<string> {
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return res.text();
}

export async function fetchQuestData(
  get: (url: string) => Promise<string> = defaultGet,
  mode: GameMode = "regular",
): Promise<QuestData> {
  const [maps, mapsEn, tasks, tasksEn, traders, tradersEn, itemsEn] = await Promise.all(
    JSON_FILES.map(async (file) => JSON.parse(await get(jsonUrl(mode, file))) as unknown),
  );
  const bundle: RawBundle = { maps, mapsEn, tasks, tasksEn, traders, tradersEn, itemsEn };
  return toQuestData(bundle, Date.now());
}

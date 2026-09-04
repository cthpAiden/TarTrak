import { fetch } from "@tauri-apps/plugin-http";
import { JSON_FILES, JSON_TARKOV_DEV, toQuestData, type RawBundle } from "./jsonSource";
import type { QuestData } from "./types";

async function defaultGet(url: string): Promise<string> {
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return res.text();
}

export async function fetchQuestData(get: (url: string) => Promise<string> = defaultGet): Promise<QuestData> {
  const [maps, mapsEn, tasks, tasksEn, traders, tradersEn] = await Promise.all(
    JSON_FILES.map(async (file) => JSON.parse(await get(`${JSON_TARKOV_DEV}/${file}`)) as unknown),
  );
  const bundle: RawBundle = { maps, mapsEn, tasks, tasksEn, traders, tradersEn };
  return toQuestData(bundle, Date.now());
}

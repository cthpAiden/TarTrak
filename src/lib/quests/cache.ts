import { BaseDirectory, exists, mkdir, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { fetchQuestData } from "./query";
import { bundledSnapshot } from "./snapshot";
import type { QuestData } from "./types";

export const CACHE_PATH = "quests/data.json";
export const MAX_AGE_MS = 86_400_000;

export type QuestSource = "network" | "cache" | "snapshot" | "none";

export interface QuestLoaderDeps {
  readCache(): Promise<QuestData | null>;
  writeCache(d: QuestData): Promise<void>;
  fetchRemote(): Promise<QuestData>;
  snapshot(): QuestData | null;
  now(): number;
}

/** A valid-JSON-but-wrong-shape cache would throw inside a $derived and blank the app. */
export function isQuestData(v: unknown): v is QuestData {
  if (typeof v !== "object" || v === null) return false;
  const d = v as Record<string, unknown>;
  return Array.isArray(d.tasks) && Array.isArray(d.maps) && typeof d.fetchedAt === "number";
}

export function isStale(fetchedAt: number, now: number): boolean {
  return now - fetchedAt > MAX_AGE_MS;
}

/** Emit the best data available now, then refresh in the background if needed. Never throws. */
export async function loadQuestData(deps: QuestLoaderDeps, onUpdate: (d: QuestData, s: QuestSource) => void): Promise<void> {
  let cached: QuestData | null = null;
  try {
    cached = await deps.readCache();
  } catch {
    cached = null;
  }
  if (cached) onUpdate(cached, "cache");
  else {
    const snap = deps.snapshot();
    if (snap) onUpdate(snap, "snapshot");
  }
  if (cached && !isStale(cached.fetchedAt, deps.now())) return;
  try {
    const fresh = await deps.fetchRemote();
    fresh.fetchedAt = deps.now();
    onUpdate(fresh, "network");
    await deps.writeCache(fresh);
  } catch {
    // offline or API down: whatever we emitted above stands
  }
}

const APP = { baseDir: BaseDirectory.AppData };

export function defaultDeps(): QuestLoaderDeps {
  return {
    async readCache() {
      if (!(await exists(CACHE_PATH, APP))) return null;
      const parsed: unknown = JSON.parse(await readTextFile(CACHE_PATH, APP));
      return isQuestData(parsed) ? parsed : null;
    },
    async writeCache(d) {
      if (!(await exists("quests", APP))) await mkdir("quests", { ...APP, recursive: true });
      await writeTextFile(CACHE_PATH, JSON.stringify(d), APP);
    },
    fetchRemote: () => fetchQuestData(),
    snapshot: bundledSnapshot,
    now: Date.now,
  };
}

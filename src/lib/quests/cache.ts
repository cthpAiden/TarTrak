import { BaseDirectory, exists, mkdir, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { fetchQuestData } from "./query";
import { bundledSnapshot } from "./snapshot";
import { QUEST_SCHEMA_VERSION, type QuestData } from "./types";
import type { GameMode } from "./jsonSource";

export const CACHE_PATH = "quests/data.json";
/** One cache per game mode; PvP keeps the historical path so an existing cache stays valid. */
export function cachePath(mode: GameMode): string {
  return mode === "regular" ? CACHE_PATH : `quests/data-${mode}.json`;
}
export const MAX_AGE_MS = 86_400_000;

export type QuestSource = "network" | "cache" | "snapshot" | "none";

export interface QuestLoaderDeps {
  readCache(): Promise<QuestData | null>;
  writeCache(d: QuestData): Promise<void>;
  fetchRemote(): Promise<QuestData>;
  /** The bundled fallback; loaded lazily, so it may be a promise. */
  snapshot(): QuestData | null | Promise<QuestData | null>;
  now(): number;
}

/** A valid-JSON-but-wrong-shape cache would throw inside a $derived and blank the app. */
export function isQuestData(v: unknown): v is QuestData {
  if (typeof v !== "object" || v === null) return false;
  const d = v as Record<string, unknown>;
  if (d.schemaVersion !== QUEST_SCHEMA_VERSION) return false;
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
    let snap: QuestData | null = null;
    try {
      snap = await deps.snapshot();
    } catch {
      snap = null;
    }
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

export function defaultDeps(mode: GameMode = "regular"): QuestLoaderDeps {
  const path = cachePath(mode);
  return {
    async readCache() {
      if (!(await exists(path, APP))) return null;
      const parsed: unknown = JSON.parse(await readTextFile(path, APP));
      return isQuestData(parsed) ? parsed : null;
    },
    async writeCache(d) {
      if (!(await exists("quests", APP))) await mkdir("quests", { ...APP, recursive: true });
      await writeTextFile(path, JSON.stringify(d), APP);
    },
    fetchRemote: () => fetchQuestData(undefined, mode),
    snapshot: bundledSnapshot,
    now: Date.now,
  };
}

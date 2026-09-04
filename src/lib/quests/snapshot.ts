import { QUEST_SCHEMA_VERSION, type QuestData, type MapInfo, type QuestTask } from "./types";

// Files are optional: the repo may ship without a snapshot if tarkov.dev was down at release time.
const files = import.meta.glob("../../../data/snapshot/*.json", { eager: true, import: "default" }) as Record<string, unknown>;

function pick<T>(name: string): T | null {
  const key = Object.keys(files).find((k) => k.endsWith(`/${name}`));
  return key ? (files[key] as T) : null;
}

export function bundledSnapshot(): QuestData | null {
  const tasks = pick<QuestTask[]>("tasks.json");
  const maps = pick<MapInfo[]>("maps.json");
  const meta = pick<{ fetchedAt: number; schemaVersion?: number }>("meta.json");
  if (!tasks || !maps) return null;
  if (meta?.schemaVersion !== QUEST_SCHEMA_VERSION) return null;
  return { schemaVersion: QUEST_SCHEMA_VERSION, tasks, maps, fetchedAt: meta.fetchedAt };
}

import type { QuestData, MapInfo, QuestTask } from "./types";

// Files are optional: the repo may ship without a snapshot if tarkov.dev was down at release time.
const files = import.meta.glob("../../../data/snapshot/*.json", { eager: true, import: "default" }) as Record<string, unknown>;

function pick<T>(name: string): T | null {
  const key = Object.keys(files).find((k) => k.endsWith(`/${name}`));
  return key ? (files[key] as T) : null;
}

export function bundledSnapshot(): QuestData | null {
  const tasks = pick<QuestTask[]>("tasks.json");
  const maps = pick<MapInfo[]>("maps.json");
  const meta = pick<{ fetchedAt: number }>("meta.json");
  if (!tasks || !maps) return null;
  return { tasks, maps, fetchedAt: meta?.fetchedAt ?? 0 };
}

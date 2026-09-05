import { QUEST_SCHEMA_VERSION, type QuestData, type MapInfo, type QuestTask } from "./types";

// The snapshot is the fallback for a first start without network. It used to be inlined into the JS
// bundle (4 MB parsed on every start, kept for the whole session); as files it costs nothing until
// it is needed. The glob yields their URLs, which Vite emits as assets in the build.
const urls = import.meta.glob("../../../data/snapshot/*.json", { eager: true, query: "?url", import: "default" }) as Record<string, string>;

function urlFor(name: string): string | null {
  const key = Object.keys(urls).find((k) => k.endsWith(`/${name}`));
  return key ? urls[key] : null;
}

async function fetchJson<T>(name: string): Promise<T | null> {
  const url = urlFor(name);
  if (!url) return null;
  const res = await fetch(url);
  if (!res.ok) return null;
  return (await res.json()) as T;
}

/** Null when the files are missing or from another schema; the loader then waits for the network. */
export async function bundledSnapshot(): Promise<QuestData | null> {
  try {
    const meta = await fetchJson<{ fetchedAt: number; schemaVersion?: number }>("meta.json");
    if (meta?.schemaVersion !== QUEST_SCHEMA_VERSION) return null;
    const [tasks, maps] = await Promise.all([fetchJson<QuestTask[]>("tasks.json"), fetchJson<MapInfo[]>("maps.json")]);
    if (!tasks || !maps) return null;
    return { schemaVersion: QUEST_SCHEMA_VERSION, tasks, maps, fetchedAt: meta.fetchedAt };
  } catch {
    return null;
  }
}

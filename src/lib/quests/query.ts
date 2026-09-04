import { fetch } from "@tauri-apps/plugin-http";
import { QUEST_SCHEMA_VERSION, type QuestData, type MapInfo, type QuestTask } from "./types";

export const TARKOV_DEV_GRAPHQL = "https://api.tarkov.dev/graphql";

const ZONE = "zones { id map { id } position { x y z } }";

const TASKS = `tasks(gameMode: regular, lang: en) {
    id name minPlayerLevel trader { name }
    objectives {
      id type description maps { id }
      ... on TaskObjectiveBasic { ${ZONE} }
      ... on TaskObjectiveItem { ${ZONE} }
      ... on TaskObjectiveQuestItem { ${ZONE} }
      ... on TaskObjectiveMark { ${ZONE} }
    }
  }`;

const MAP_BASE = `id name normalizedName
    extracts { id name faction position { x y z } }`;

const MAP_LAYERS = `transits { id description position { x y z } }
    spawns { zoneName position { x y z } sides categories }
    lootContainers { lootContainer { id name normalizedName } position { x y z } }
    locks { lockType key { name } position { x y z } }
    hazards { hazardType name position { x y z } }
    switches { id name position { x y z } }
    btrStations { id name position { x y z } }`;

export const QUEST_QUERY = `{
  ${TASKS}
  maps(gameMode: regular, lang: en) {
    ${MAP_BASE}
    ${MAP_LAYERS}
  }
}`;

/** Quests and extracts only. Used when the full query is rejected, so a renamed layer field can never take the quests down with it. */
export const QUEST_QUERY_MINIMAL = `{
  ${TASKS}
  maps(gameMode: regular, lang: en) {
    ${MAP_BASE}
  }
}`;

async function defaultPost(url: string, body: string): Promise<string> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body });
  if (!res.ok) throw new Error(`POST ${url} -> ${res.status}`);
  return res.text();
}

type Reply = { data?: { tasks?: QuestTask[]; maps?: MapInfo[] } | null; errors?: unknown };

async function ask(post: (url: string, body: string) => Promise<string>, query: string): Promise<Reply> {
  return JSON.parse(await post(TARKOV_DEV_GRAPHQL, JSON.stringify({ query }))) as Reply;
}

export async function fetchQuestData(post: (url: string, body: string) => Promise<string> = defaultPost): Promise<QuestData> {
  let json = await ask(post, QUEST_QUERY);
  // A GraphQL validation error (unknown field) comes back as 200 with `errors` and no data.
  if (!json.data?.tasks || !json.data.maps) json = await ask(post, QUEST_QUERY_MINIMAL);
  if (!json.data?.tasks || !json.data.maps) {
    throw new Error(`tarkov.dev returned no data: ${JSON.stringify(json.errors ?? json).slice(0, 200)}`);
  }
  return { schemaVersion: QUEST_SCHEMA_VERSION, tasks: json.data.tasks, maps: json.data.maps, fetchedAt: Date.now() };
}

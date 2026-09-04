// Refresh data/snapshot/*.json from tarkov.dev. Run before tagging a release.
import { mkdirSync, writeFileSync } from "node:fs";

const URL = "https://api.tarkov.dev/graphql";
const ZONE = "zones { id map { id } position { x y z } }";
const QUERY = `{
  tasks(gameMode: regular, lang: en) {
    id name minPlayerLevel trader { name }
    objectives {
      id type description maps { id }
      ... on TaskObjectiveBasic { ${ZONE} }
      ... on TaskObjectiveItem { ${ZONE} }
      ... on TaskObjectiveQuestItem { ${ZONE} }
      ... on TaskObjectiveMark { ${ZONE} }
    }
  }
  maps(gameMode: regular, lang: en) {
    id name normalizedName
    extracts { id name faction position { x y z } }
    transits { id description position { x y z } }
    spawns { zoneName position { x y z } sides categories }
    lootContainers { lootContainer { id name normalizedName } position { x y z } }
    locks { lockType key { name } position { x y z } }
    hazards { hazardType name position { x y z } }
    switches { id name position { x y z } }
    btrStations { id name position { x y z } }
  }
}`;

const res = await fetch(URL, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ query: QUERY }),
});
const json = (await res.json()) as { data?: { tasks: unknown[]; maps: unknown[] }; errors?: unknown };
if (!res.ok || !json.data) {
  console.error("tarkov.dev unavailable:", res.status, JSON.stringify(json.errors ?? json).slice(0, 300));
  process.exit(1);
}
mkdirSync("data/snapshot", { recursive: true });
writeFileSync("data/snapshot/tasks.json", JSON.stringify(json.data.tasks));
writeFileSync("data/snapshot/maps.json", JSON.stringify(json.data.maps));
writeFileSync("data/snapshot/meta.json", JSON.stringify({ fetchedAt: Date.now(), schemaVersion: 2 }));
console.log(`snapshot: ${json.data.tasks.length} tasks, ${json.data.maps.length} maps`);

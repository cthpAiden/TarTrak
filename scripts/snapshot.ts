// Refresh data/snapshot/*.json from json.tarkov.dev. Run before tagging a release.
import { mkdirSync, writeFileSync } from "node:fs";
import { JSON_FILES, JSON_TARKOV_DEV, toQuestData, type RawBundle } from "../src/lib/quests/jsonSource.ts";

const bodies = await Promise.all(
  JSON_FILES.map(async (file) => {
    const url = `${JSON_TARKOV_DEV}/${file}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`json.tarkov.dev unavailable: GET ${url} -> ${res.status}`);
      process.exit(1);
    }
    return (await res.json()) as unknown;
  }),
);
const [maps, mapsEn, tasks, tasksEn, traders, tradersEn, itemsEn] = bodies;
const bundle: RawBundle = { maps, mapsEn, tasks, tasksEn, traders, tradersEn, itemsEn };
const data = toQuestData(bundle, Date.now());

mkdirSync("data/snapshot", { recursive: true });
writeFileSync("data/snapshot/tasks.json", JSON.stringify(data.tasks));
writeFileSync("data/snapshot/maps.json", JSON.stringify(data.maps));
writeFileSync("data/snapshot/meta.json", JSON.stringify({ fetchedAt: data.fetchedAt, schemaVersion: data.schemaVersion }));
console.log(`snapshot: ${data.tasks.length} tasks, ${data.maps.length} maps`);

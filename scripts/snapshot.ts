// Refresh data/snapshot/*.json and data/itemCategories.json from json.tarkov.dev. Run before tagging a release.
import { mkdirSync, writeFileSync } from "node:fs";
import { JSON_FILES, JSON_TARKOV_DEV, type RawBundle } from "../src/lib/quests/jsonSource.ts";

async function getJson(file: string): Promise<unknown> {
  const url = `${JSON_TARKOV_DEV}/${file}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`json.tarkov.dev unavailable: GET ${url} -> ${res.status}`);
    process.exit(1);
  }
  return res.json();
}

// The items file is 17 MB, so the app never fetches it: only the item -> handbook category map
// tarkov.dev sorts loose loot by is kept, bundled here. Names resolve through items_en.
type Dict = Record<string, any>;
const items = ((await getJson("items")) as Dict).data as Dict;
const bodies = await Promise.all(JSON_FILES.map(getJson));
const [maps, mapsEn, tasks, tasksEn, traders, tradersEn, itemsEn] = bodies;
const itemNames = (itemsEn as Dict).data as Dict;
const categories: Record<string, string> = {};
for (const c of Object.values(items.handbookCategories as Dict) as Dict[]) categories[c.normalizedName] = itemNames[c.name] ?? c.normalizedName;
const byItem: Record<string, string> = {};
for (const it of Object.values(items.items as Dict) as Dict[]) {
  const cat = (items.handbookCategories as Dict)[it.handbookCategories?.[0]];
  byItem[it.id] = cat ? cat.normalizedName : "";
}
writeFileSync("data/itemCategories.json", JSON.stringify({ categories, items: byItem }));
console.log(`itemCategories: ${Object.keys(byItem).length} items, ${Object.keys(categories).length} categories`);
// The adapter bundles that file, so it is loaded only now that the fresh one is on disk.
const { toQuestData } = await import("../src/lib/quests/jsonSource.ts");
const bundle: RawBundle = { maps, mapsEn, tasks, tasksEn, traders, tradersEn, itemsEn };
const data = toQuestData(bundle, Date.now());

mkdirSync("data/snapshot", { recursive: true });
writeFileSync("data/snapshot/tasks.json", JSON.stringify(data.tasks));
writeFileSync("data/snapshot/maps.json", JSON.stringify(data.maps));
writeFileSync("data/snapshot/meta.json", JSON.stringify({ fetchedAt: data.fetchedAt, schemaVersion: data.schemaVersion }));
console.log(`snapshot: ${data.tasks.length} tasks, ${data.maps.length} maps`);

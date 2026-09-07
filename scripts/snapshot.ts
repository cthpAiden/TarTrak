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
const categoryImages: Record<string, string> = {};
for (const c of Object.values(items.handbookCategories as Dict) as Dict[]) {
  categories[c.normalizedName] = itemNames[c.name] ?? c.normalizedName;
  if (typeof c.imageLink === "string" && c.imageLink.startsWith("https://assets.tarkov.dev/")) categoryImages[c.normalizedName] = c.imageLink;
}
const byItem: Record<string, string> = {};
// Item pictures sit at assets.tarkov.dev/<id>-base-image.webp for nearly every item. The few presets
// and variants that borrow another item's picture are listed by the id they borrow; an item with no
// picture at all (a placeholder link) is listed as "", so the app draws the generic icon for it.
const imageIds: Record<string, string> = {};
const PICTURE = /^https:\/\/assets\.tarkov\.dev\/([0-9a-f]{24})-base-image\.webp$/;
for (const it of Object.values(items.items as Dict) as Dict[]) {
  const cat = (items.handbookCategories as Dict)[it.handbookCategories?.[0]];
  byItem[it.id] = cat ? cat.normalizedName : "";
  const picture = PICTURE.exec(typeof it.baseImageLink === "string" ? it.baseImageLink : "");
  if (!picture) imageIds[it.id] = "";
  else if (picture[1] !== it.id) imageIds[it.id] = picture[1];
}
writeFileSync("data/itemCategories.json", JSON.stringify({ categories, categoryImages, items: byItem, imageIds }));
console.log(
  `itemCategories: ${Object.keys(byItem).length} items, ${Object.keys(categories).length} categories, ${Object.keys(imageIds).length} borrowed or missing pictures`,
);
// The adapter bundles that file, so it is loaded only now that the fresh one is on disk.
const { toQuestData } = await import("../src/lib/quests/jsonSource.ts");
const { CURATED_EXTRACTS } = await import("../src/lib/quests/curatedExtracts.ts");
const bundle: RawBundle = { maps, mapsEn, tasks, tasksEn, traders, tradersEn, itemsEn };
const data = toQuestData(bundle, Date.now());

// What data/extracts.json put back, and what upstream lists that the file left off: both are worth
// a look before a release, since upstream has dropped and misfiled real extracts before (September 2026).
const bare = toQuestData(bundle, Date.now(), {});
for (const m of data.maps) {
  const upstream = new Set(bare.maps.find((b) => b.normalizedName === m.normalizedName)?.extracts.map((e) => e.name));
  const curated = CURATED_EXTRACTS[m.normalizedName];
  if (!curated) continue;
  const restored = m.extracts.filter((e) => !upstream.has(e.name)).map((e) => e.name);
  const known = new Set(curated.map((e) => e.name));
  const dropped = [...upstream].filter((n) => !known.has(n));
  if (restored.length > 0) console.log(`${m.normalizedName}: restored from data/extracts.json: ${restored.join(", ")}`);
  if (dropped.length > 0) console.log(`${m.normalizedName}: upstream lists, left off as data/extracts.json does not know them: ${dropped.join(", ")}`);
}

mkdirSync("data/snapshot", { recursive: true });
writeFileSync("data/snapshot/tasks.json", JSON.stringify(data.tasks));
writeFileSync("data/snapshot/maps.json", JSON.stringify(data.maps));
writeFileSync("data/snapshot/meta.json", JSON.stringify({ fetchedAt: data.fetchedAt, schemaVersion: data.schemaVersion }));
console.log(`snapshot: ${data.tasks.length} tasks, ${data.maps.length} maps`);

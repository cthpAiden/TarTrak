# Map Filters and Trader-Grouped Quests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a TarkovQuestie-style filter tree (extracts, quests, spawns, containers, locks, hazards, switches, BTR) with per-map counts and persisted toggles, plus a trader-grouped quest list with per-quest hide.

**Architecture:** tarkov.dev map data is flattened into a generic `MapPoint { group, category }` list by a pure module; a pure filter module resolves `group/category` keys against persisted settings with defaults; `MapView` renders the pre-filtered points in one layer group; a new `FilterPanel` and a regrouped `QuestPanel` drive the settings. Spec: `docs/superpowers/specs/2026-09-04-map-filters-design.md`.

**Tech Stack:** Svelte 5 runes, TypeScript, Leaflet 1.9, vitest (jsdom), Tauri plugin-store. No new dependencies.

## Global Constraints

- Ban-safe: read-only data from tarkov.dev; no game memory, hooks, or input. No TarkovQuestie code or assets.
- Svelte 5 runes only (`$state`, `$derived`, `$effect`, `$props`); `$state.raw` for large wholly-replaced values.
- Leaflet renders string tooltips/popups as HTML: every remote string goes through `esc()` from `src/lib/quests/questLayer.ts`.
- Filter key format: `"<group>"` or `"<group>/<category>"`; regex `/^[a-z]+(\/[a-z0-9_-]+)?$/i`.
- `QUEST_SCHEMA_VERSION = 2`; data without it is treated as absent.
- Defaults on: `extracts/pmc`, `extracts/shared`, `extracts/transit`, `quests/visit`, `quests/questItem`, `quests/mark`, `quests/item`, `quests/other`. Everything else off.
- Trader order: Prapor, Therapist, Skier, Peacekeeper, Mechanic, Ragman, Jaeger, Fence, Lightkeeper, Ref, BTR Driver, then others alphabetically.
- `loot` and `spawns` render as `L.circleMarker` radius 4 on one shared `L.canvas()` renderer; other groups use `L.divIcon` with classes `point-icon <group> <category>`.
- Tests: `npm test` (vitest), `npm run check` (svelte-check), `npm run build` must all pass at the end of every task. Commit per task to `main` with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Match existing style: 2-space indent, double quotes, comments only where the reason is non-obvious.

---

### Task 1: Query, types, schema version

**Files:**
- Modify: `src/lib/quests/types.ts`
- Modify: `src/lib/quests/query.ts`
- Modify: `src/lib/quests/cache.ts` (`isQuestData`)
- Modify: `src/lib/quests/snapshot.ts`
- Modify: `scripts/snapshot.ts`
- Modify: `src/lib/quests/cache.test.ts`, `src/lib/quests/markers.test.ts`, `src/lib/quests/questLayer.test.ts` (fixtures gain `schemaVersion`)

**Interfaces produced:**
```ts
// types.ts
export const QUEST_SCHEMA_VERSION = 2;
export interface MapTransit { id: string; description: string; position: Vec3 | null }
export interface MapSpawn { zoneName: string | null; position: Vec3 | null; sides: string[]; categories: string[] }
export interface MapLootContainer { lootContainer: { id: string; name: string; normalizedName: string }; position: Vec3 | null }
export interface MapLock { lockType: string; key: { name: string } | null; position: Vec3 | null }
export interface MapHazard { hazardType: string; name: string; position: Vec3 | null }
export interface MapSwitch { id: string; name: string; position: Vec3 | null }
export interface MapBtrStation { id: string; name: string; position: Vec3 | null }
export interface MapInfo {
  id: string; name: string; normalizedName: string;
  extracts: MapExtract[];
  transits?: MapTransit[] | null; spawns?: MapSpawn[] | null; lootContainers?: MapLootContainer[] | null;
  locks?: MapLock[] | null; hazards?: MapHazard[] | null; switches?: MapSwitch[] | null; btrStations?: MapBtrStation[] | null;
}
export interface QuestData { schemaVersion: number; tasks: QuestTask[]; maps: MapInfo[]; fetchedAt: number }
```

- [ ] **Step 1: Probe the tarkov.dev schema**

Run:
```bash
curl -s -m 20 -X POST https://api.tarkov.dev/graphql -H "content-type: application/json" -d '{"query":"{ __type(name:\"Map\"){ fields { name } } }"}'
```
If the response lists fields, confirm each of `transits spawns lootContainers locks hazards switches btrStations` exists and probe sub-fields the same way (`__type(name:"MapSpawn")`, `"Lock"`, `"MapHazard"`, `"MapSwitch"`, `"MapBtrStation"`, `"MapTransit"`, `"LootContainerPosition"`). Drop any field that does not exist from the query and the types, and write the dropped list in your report. If the API returns `GraphQL server unavailable`, keep the full field set from the spec and say so in the report.

- [ ] **Step 2: Failing test for `isQuestData` schema check**

Add to `cache.test.ts`:
```ts
it("rejects data without the current schemaVersion", () => {
  expect(isQuestData({ tasks: [], maps: [], fetchedAt: 1 })).toBe(false);
  expect(isQuestData({ schemaVersion: 1, tasks: [], maps: [], fetchedAt: 1 })).toBe(false);
  expect(isQuestData({ schemaVersion: QUEST_SCHEMA_VERSION, tasks: [], maps: [], fetchedAt: 1 })).toBe(true);
});
```
Run `npx vitest run src/lib/quests/cache.test.ts`; expect the new test to fail.

- [ ] **Step 3: Implement**

`types.ts`: add the interfaces above. `cache.ts`: `isQuestData` also requires `d.schemaVersion === QUEST_SCHEMA_VERSION`. `query.ts`: extend the `maps` selection:
```graphql
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
```
`fetchQuestData` returns `{ schemaVersion: QUEST_SCHEMA_VERSION, tasks, maps, fetchedAt }`. `snapshot.ts`: `bundledSnapshot` returns `null` unless `meta.schemaVersion === QUEST_SCHEMA_VERSION`. `scripts/snapshot.ts`: same query text (copy it; there is no shared module between the Vite app and the Node script) and write `meta.json` as `{ fetchedAt, schemaVersion: 2 }`.

Update every test fixture that builds a `QuestData` to include `schemaVersion: QUEST_SCHEMA_VERSION`.

- [ ] **Step 4: Verify and commit**

`npm test && npm run check`. Commit: `Add schema version and map layer fields to quest data`.

---

### Task 2: Point model

**Files:**
- Create: `src/lib/layers/points.ts`
- Test: `src/lib/layers/points.test.ts`

**Interfaces produced:**
```ts
export type GroupId = "extracts" | "spawns" | "loot" | "locks" | "hazards" | "switches" | "btr";
export const GROUP_ORDER: readonly GroupId[] = ["extracts", "spawns", "loot", "locks", "hazards", "switches", "btr"];
export const GROUP_LABELS: Record<GroupId, string> = { extracts: "Extracts", spawns: "Spawns", loot: "Containers", locks: "Locks", hazards: "Hazards", switches: "Switches", btr: "BTR" };
export const CATEGORY_LABELS: Record<string, string> = {
  "extracts/pmc": "PMC Extracts", "extracts/scav": "SCAV Extracts", "extracts/shared": "Co-op Extracts", "extracts/transit": "Transit Zones",
  "spawns/pmc": "PMC", "spawns/scav": "Scav", "spawns/boss": "Boss", "spawns/sniper": "Sniper",
  "locks/door": "Doors", "locks/container": "Containers", "locks/trunk": "Trunks",
  "switches/switch": "Switches", "btr/stop": "BTR stops",
};
export interface MapPoint { id: string; group: GroupId; category: string; name: string; mapKey: string; x: number; y: number; z: number }
export function filterKey(p: { group: string; category: string }): string; // `${group}/${category}`
export function extractPoints(data: QuestData): MapPoint[];
/** Label for a category key: CATEGORY_LABELS, else the name of the first point with that key (loot uses container names), else the slug. */
export function categoryLabel(key: string, points: MapPoint[]): string;
```

- [ ] **Step 1: Failing tests**

Fixture: one map `{ id: "m1", normalizedName: "streets", extracts: [pmc, scav, shared, one with position null], transits: [1], spawns: [ {sides:["pmc","scav"],categories:["player"]}, {sides:["scav"],categories:["bot"]}, {sides:["scav"],categories:["boss"]}, {sides:["scav"],categories:["sniper"]} ], lootContainers: [ safe, safe, medcase ], locks: [ {lockType:"door", key:{name:"Office key"}}, {lockType:"trunk", key:null} ], hazards: [1], switches: [1], btrStations: [1] }`, plus a second map with every optional array missing.

Cases:
1. extracts produce categories `pmc`, `scav`, `shared`; the null-position one is skipped; transit becomes `extracts/transit` with `name === description`.
2. spawns map to `pmc`, `scav`, `boss`, `sniper` in that order.
3. loot: two points with category `safe`, one `medcase`; names are the container `name`.
4. locks: `door` named `Office key`; `trunk` named `Locked trunk`.
5. hazards/switches/btr: categories `<hazardType>`, `switch`, `stop`.
6. every point has `mapKey === "streets"`; the second map contributes zero points and does not throw.
7. `filterKey({ group: "loot", category: "safe" }) === "loot/safe"`.
8. ids are unique across the result; spawns (no API id) use `spawns/<category>/<index>`.
9. `categoryLabel("extracts/pmc", [])` is `"PMC Extracts"`; `categoryLabel("loot/safe", points)` is `"Safe"`; unknown key returns the slug after the slash.

- [ ] **Step 2: Implement** per the spec table. Iterate `m.transits ?? []` etc. Skip entries with no position.

- [ ] **Step 3: Verify and commit**: `npm test && npm run check`. Commit: `Add generic map point model from tarkov.dev layers`.

---

### Task 3: Filter resolution

**Files:**
- Create: `src/lib/layers/filters.ts`
- Test: `src/lib/layers/filters.test.ts`

**Interfaces produced:**
```ts
export type Filters = Record<string, boolean>;
export const DEFAULT_ON: ReadonlySet<string>; // per Global Constraints
export const FILTER_KEY_RE = /^[a-z]+(\/[a-z0-9_-]+)?$/i;
export function isOn(f: Filters, group: string, category: string): boolean;
export type GroupState = "all" | "none" | "some";
export function groupState(f: Filters, group: string, categories: readonly string[]): GroupState; // "none" when categories is empty and group resolves off
export function setGroup(f: Filters, group: string, on: boolean): Filters;      // returns a new object; deletes `${group}/*`
export function setCategory(f: Filters, group: string, category: string, on: boolean): Filters; // new object
```

- [ ] **Step 1: Failing tests**
1. `isOn({}, "extracts", "pmc")` true; `isOn({}, "loot", "safe")` false; `isOn({}, "extracts", "scav")` false.
2. category key beats group key: `isOn({ loot: true, "loot/safe": false }, "loot", "safe")` false.
3. group key beats default: `isOn({ extracts: false }, "extracts", "pmc")` false.
4. `groupState({}, "extracts", ["pmc","scav","shared","transit"])` is `"some"`; with `{ extracts: true }` is `"all"`; with `{ extracts: false }` is `"none"`; with empty categories and no keys is `"none"` for loot and `"all"` for a group whose defaults are all on is not required (skip).
5. `setGroup({ "loot/safe": true, "spawns/pmc": true }, "loot", false)` equals `{ loot: false, "spawns/pmc": true }` and does not mutate the input.
6. `setCategory({}, "loot", "safe", true)` equals `{ "loot/safe": true }`.
7. `FILTER_KEY_RE` accepts `loot`, `loot/safe`, `Loot/weapon_box-2`; rejects `loot/`, `/safe`, `a/b/c`, `loot safe`.

- [ ] **Step 2: Implement.** - [ ] **Step 3: Verify and commit**: `Add filter key resolution with defaults`.

---

### Task 4: Settings keys

**Files:**
- Modify: `src/lib/settings/store.ts`
- Modify: `src/lib/settings/store.test.ts`

- [ ] **Step 1: Failing tests**
1. defaults: `mergeSettings(undefined).layerFilters` is `{}` and `.hiddenQuests` is `{}`.
2. `mergeSettings({ layerFilters: { loot: true, "loot/safe": false } })` keeps both.
3. `layerFilters: { loot: "yes" }` and `layerFilters: []` and `layerFilters: { "a/b/c": true }` each reset to `{}`.
4. 501 boolean keys are truncated to 500 (first 500 by insertion order).
5. `hiddenQuests: { t1: true }` kept; `{ t1: false }` reset to `{}`; 2001 keys truncated to 2000.

- [ ] **Step 2: Implement.** Add both fields to `Settings`, `DEFAULT_SETTINGS`, and a new `Kind` `"record"` in `SHAPE` accepted when the value is a non-array object. Validate in `mergeSettings` after the loop using `FILTER_KEY_RE` from `../layers/filters`. Note the store test module imports `store.ts` which imports `@tauri-apps/plugin-store`; check how the existing test mocks it and keep that pattern.

- [ ] **Step 3: Verify and commit**: `Persist layer filters and hidden quests in settings`.

---

### Task 5: Quest categories, remove extract path

**Files:**
- Modify: `src/lib/quests/questLayer.ts`, `src/lib/quests/questLayer.test.ts`
- Modify: `src/lib/quests/markers.ts`, `src/lib/quests/markers.test.ts`

**Interfaces produced:**
```ts
export type QuestCategory = "visit" | "questItem" | "mark" | "item" | "other";
export const QUEST_CATEGORIES: readonly QuestCategory[];
export const QUEST_CATEGORY_LABELS: Record<QuestCategory, string> = { visit: "Visit", questItem: "Quest items", mark: "Mark", item: "Items", other: "Other" };
export function questCategory(objectiveType: string): QuestCategory;
// QuestMarker gains `category: QuestCategory`, set by extractQuestMarkers.
```

- [ ] **Step 1: Failing tests**: `questCategory` for `visit`, `findQuestItem`, `mark`, each of `ITEM_TYPES`, `shoot` -> `other`; `extractQuestMarkers` sets `category`.
- [ ] **Step 2: Implement.** Delete `ExtractMarker`, `extractExtracts`, `extractDivIcon` and their tests. `iconFor` may delegate to `questCategory`. The build will break in `MapView.svelte` and `App.svelte` until Task 7; that is expected. `npm test` must pass; `npm run check` is allowed to fail on those two files only, and the report must name them.
- [ ] **Step 3: Commit**: `Categorize quest markers and drop the extract-only path`.

---

### Task 6: Trader grouping

**Files:**
- Create: `src/lib/quests/grouping.ts`
- Test: `src/lib/quests/grouping.test.ts`

**Interfaces produced:**
```ts
export const TRADER_ORDER: readonly string[]; // per Global Constraints
export interface GroupOpts { search: string; hideDone: boolean; playerLevel: number; done: Record<string, true>; countsOnMap: Map<string, number> }
export interface TraderGroup { trader: string; done: number; total: number; tasks: { t: QuestTask; count: number }[] }
/** total/done count every task of the trader regardless of search or hideDone; `tasks` is the filtered, sorted list. Groups with no tasks after filtering are omitted. */
export function groupByTrader(tasks: QuestTask[], opts: GroupOpts): TraderGroup[];
```

- [ ] **Step 1: Failing tests**: order (Ref before Prapor in input; output Prapor first; an unknown trader "Zed" after BTR Driver); done/total unaffected by search; hideDone removes done tasks but keeps counts; playerLevel 0 shows all, 10 hides minPlayerLevel 11; sort: on-map count desc, then level asc, then name; search matches trader name; empty group omitted.
- [ ] **Step 2: Implement.** - [ ] **Step 3: Commit**: `Group quests by trader with progress counts`.

---

### Task 7: MapView points layer

**Files:**
- Modify: `src/lib/map/MapView.svelte`
- Modify: `src/lib/map/map.css`
- Create: `src/lib/layers/pointLayer.ts` (pure helpers, tested)
- Test: `src/lib/layers/pointLayer.test.ts`

**Interfaces produced:**
```ts
// pointLayer.ts
export const GLYPHS: Record<GroupId, string> = { extracts: "⇲", spawns: "✦", loot: "", locks: "🔒", hazards: "☢", switches: "⏻", btr: "⛟" };
export function usesCanvas(group: GroupId): boolean; // loot and spawns
export function pointDivIcon(p: MapPoint): L.DivIcon; // className `point-icon ${p.group} ${p.category}`, html `<span title="${esc(p.name)}">${GLYPHS[p.group]}</span>`, 18x18 anchored 9,9
```
MapView props become `{ def, pinnedFloor, onFloorPinned, questMarkers, points, lineLengthPx }`.

- [ ] **Step 1: Failing tests**: `usesCanvas("loot")` and `("spawns")` true, others false; `pointDivIcon` className contains group and category and the html escapes `<` in the name.
- [ ] **Step 2: Implement.** In `build()` create `pointGroup = L.layerGroup().addTo(m)` and `canvas = L.canvas({ padding: 0.5 })`. Replace the extracts effect:
```ts
$effect(() => {
  const all = points;
  const g = pointGroup;
  if (!g) return;
  g.clearLayers();
  for (const p of all) {
    const ll = toLatLng(p.x, p.z);
    const layer = usesCanvas(p.group)
      ? L.circleMarker(ll, { renderer: canvas, radius: 4, className: `point-canvas ${p.group} ${p.category}`, color: colorFor(p), fillColor: colorFor(p), fillOpacity: 0.9, weight: 1 })
      : L.marker(ll, { icon: pointDivIcon(p) });
    layer.bindTooltip(esc(p.name)).addTo(g);
  }
});
```
Canvas paths ignore CSS classes for colour, so `colorFor(p)` in `pointLayer.ts` returns the hex colour by `group/category` with a group fallback; the same hex values go into `map.css` for div icons. Colours: extracts pmc `#7fd47f`, scav `#ffa64d`, shared `#7fc7ff`, transit `#c58bff`; spawns pmc `#f0d060`, scav `#ffa64d`, boss `#ff5c5c`, sniper `#ffffff`; loot `#d2b48c`; locks `#b0b8c0`; hazards `#ff5c5c`; switches `#5ce0e6`; btr `#a8b060`.
Remove `extractDivIcon`, `extracts`, `showExtracts`. Add `.point-icon span` rules mirroring `.quest-icon span`, and per-class colours.
- [ ] **Step 3: Verify**: `npm test`; `npm run check` may still fail only in `App.svelte`. Commit: `Render generic map points with canvas for dense groups`.

---

### Task 8: FilterPanel and App wiring

**Files:**
- Create: `src/lib/layers/FilterPanel.svelte`
- Create: `src/lib/layers/counts.ts` + `counts.test.ts`
- Modify: `src/App.svelte`

**Interfaces produced:**
```ts
// counts.ts
export interface CategoryCount { key: string; group: string; category: string; label: string; total: number; shown: number }
export interface GroupCount { group: string; label: string; state: GroupState; total: number; shown: number; categories: CategoryCount[] }
/** Groups in GROUP_ORDER with "quests" inserted second (after extracts). Quest categories are QUEST_CATEGORIES with QUEST_CATEGORY_LABELS. Point categories are the distinct keys present on `mapPoints`, sorted by label. Groups with no categories still appear with total 0. */
export function buildCounts(mapPoints: MapPoint[], mapQuestMarkers: QuestMarker[], filters: Filters): GroupCount[];
```
FilterPanel props: `{ counts: GroupCount[]; filters: Filters; onChange: (f: Filters) => void }`. Internal `$state` for `search` and `collapsed: Record<string, boolean>` (default collapsed for every group except `extracts` and `quests`).

- [ ] **Step 1: Failing tests for `buildCounts`**: group order (`extracts`, `quests`, `spawns`, `loot`, ...); total/shown respect `isOn`; quests group always lists 5 categories; a loot category present only on another map does not appear (input is already per-map).
- [ ] **Step 2: Implement panel.** Tri-state: `<input type="checkbox" checked={g.state === "all"} indeterminate={g.state === "some"} onchange={() => onChange(setGroup(filters, g.group, g.state !== "all"))}>`. Category rows call `setCategory`. Show a glyph span with class `point-icon <group> <category>` reusing `map.css` colours (import `../map/map.css` is already global via MapView; if the panel can render before MapView, import it in the panel too). Search filters category rows by label; a group whose rows are all filtered out is hidden while searching.
- [ ] **Step 3: Wire App.svelte.** Derived values exactly as in the spec's App.svelte section; `points` and `questMarkers` passed to MapView; `<FilterPanel counts={buildCounts(mapPoints, mapQuestMarkersBeforeFilters, settings.layerFilters)} filters={settings.layerFilters} onChange={(f) => patchSettings({ layerFilters: f })} />` placed first in the sidebar. Remove `showExtracts` and the topbar checkbox. `mapQuestMarkersBeforeFilters` is `visibleQuestMarkers(...)` filtered by `hiddenQuests` but not by layer filters, so `shown/total` reflects the toggles.
- [ ] **Step 4: Verify**: `npm test && npm run check && npm run build`. Commit: `Add map filter panel with per-map counts`.

---

### Task 9: Trader-grouped QuestPanel

**Files:**
- Modify: `src/lib/quests/QuestPanel.svelte`
- Modify: `src/App.svelte` (props)
- Modify: `README.md` (usage section: filters and quest list)

Props: `{ markers: QuestMarker[]; playerLevel: number; onPlayerLevel: (n: number) => void; hiddenQuests: Record<string, true>; onHiddenChange: (h: Record<string, true>) => void }`.

- [ ] **Step 1: Implement.** Replace the flat `tasks` derived with `groupByTrader(data.tasks, { search, hideDone, playerLevel, done: app.doneQuests, countsOnMap })`. Render:
```svelte
{#each groups as g (g.trader)}
  <div class="trader">
    <button class="hdr" onclick={() => (collapsed[g.trader] = !collapsed[g.trader])} aria-expanded={!collapsed[g.trader]}>
      <span class="tri">{collapsed[g.trader] ? "▸" : "▾"}</span>{g.trader}<span class="cnt">{g.done}/{g.total}</span>
    </button>
    {#if !collapsed[g.trader]}
      <ul>
        {#each g.tasks as { t, count } (t.id)}
          <li class:done={app.doneQuests[t.id]} class:hidden={hiddenQuests[t.id]}>
            <input type="checkbox" aria-label="Mark {t.name} done" checked={!!app.doneQuests[t.id]} onchange={() => toggle(t.id)} />
            <span class="name">{t.name}</span>
            <button class="eye" aria-pressed={!!hiddenQuests[t.id]} title={hiddenQuests[t.id] ? "Show on map" : "Hide on map"} onclick={() => flipHidden(t.id)}>{hiddenQuests[t.id] ? "◌" : "◉"}</button>
            <span class="meta">lvl {t.minPlayerLevel}{#if count} · {count} here{/if}</span>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
{/each}
```
`flipHidden` builds a new object (add or delete the key) and calls `onHiddenChange`. `.hidden .name { opacity: .5 }`. Grid: `auto 1fr auto` with `.meta` on row 2 column 2.
- [ ] **Step 2: Wire App.svelte**: `hiddenQuests={settings.hiddenQuests} onHiddenChange={(h) => patchSettings({ hiddenQuests: h })}`.
- [ ] **Step 3: README**: under usage, add a "Filters" paragraph (groups, counts, defaults, persisted) and update the quest list description (by trader, eye toggle).
- [ ] **Step 4: Verify**: `npm test && npm run check && npm run build`. Commit: `Group the quest panel by trader with per-quest map toggles`.

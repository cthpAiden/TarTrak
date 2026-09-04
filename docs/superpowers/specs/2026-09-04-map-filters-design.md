# TarTrak Map Filters and Trader-Grouped Quests

Date: 2026-09-04. Extends the v1 design (`2026-09-04-tartrak-v1-design.md`). All v1 constraints
(ban-safe, $0, no accounts, MIT, never copy TarkovQuestie code or assets) still apply. The goal is
feature parity with TarkovQuestie's map filter tree and quest list, built only from tarkov.dev data.

## Goal

The user can toggle every kind of marker on the map by group and by category, see how many of each
are on the current map, hide single quests, and browse quests grouped by trader with progress counts.
Toggles persist across restarts.

## Data

### tarkov.dev query

`QUEST_QUERY` gains these `maps` fields (all positions are `{ x y z }`):

| Field | Selection |
|---|---|
| `extracts` | `id name faction position` (all factions, no longer filtered to pmc/shared at extraction) |
| `transits` | `id description position` |
| `spawns` | `zoneName position sides categories` |
| `lootContainers` | `lootContainer { id name normalizedName } position` |
| `locks` | `lockType key { name } position` |
| `hazards` | `hazardType name position` |
| `switches` | `id name position` |
| `btrStations` | `id name position` |

tarkov.dev was unreachable on the design day. The first implementation task probes the schema with
an introspection query on `Map`. Any field above that does not exist is dropped from the query, its
type, and its group; the plan records which were dropped. Fields that come back as `null` or missing
at runtime are treated as `[]`.

### Types (`src/lib/quests/types.ts`)

`MapInfo` gains optional arrays for each field above with matching element interfaces
(`MapTransit`, `MapSpawn`, `MapLootContainer`, `MapLock`, `MapHazard`, `MapSwitch`, `MapBtrStation`).
`MapExtract.faction` stays a string.

`QuestData` gains `schemaVersion: number`. Current value: `2` (`QUEST_SCHEMA_VERSION` exported from
`types.ts`). `isQuestData` requires `schemaVersion === QUEST_SCHEMA_VERSION`; a cache or bundled
snapshot without it is treated as absent so the app refetches instead of running for up to 24 h
without the new layers. `fetchQuestData` and `scripts/snapshot` stamp the version.

## Point model (`src/lib/layers/points.ts`, pure)

```ts
export type GroupId = "extracts" | "spawns" | "loot" | "locks" | "hazards" | "switches" | "btr";
export interface MapPoint {
  id: string;        // unique within a map; falls back to `${group}/${category}/${index}` when the API has no id
  group: GroupId;
  category: string;  // stable slug, see table
  name: string;      // tooltip text
  mapKey: string;    // normalizedName
  x: number; y: number; z: number;
}
export function extractPoints(data: QuestData): MapPoint[];
export function filterKey(p: { group: string; category: string }): string; // `${group}/${category}`
```

Category derivation:

| Group | Category | Source |
|---|---|---|
| extracts | `pmc`, `scav`, `shared` | `extract.faction` |
| extracts | `transit` | every `transits` entry; name = `description` |
| spawns | `boss` if `categories` includes `boss`; else `sniper` if it includes `sniper`; else `scav` if `sides` is only `scav`; else `pmc` | `spawn.sides`, `spawn.categories` |
| loot | `lootContainer.normalizedName` | one category per container type; display name = `lootContainer.name` |
| locks | `lock.lockType` (`door`, `container`, `trunk`, other values pass through) | name = key name or `Locked ${lockType}` |
| hazards | `hazardType` | name = `hazard.name` |
| switches | `switch` | name = `switch.name` |
| btr | `stop` | name = `station.name` |

Points without a position are skipped. Category display names come from a small
`CATEGORY_LABELS: Record<string, string>` in `points.ts` for the fixed slugs; loot categories use the
container name from the data (collected via `categoryLabel(points, key)`).

### Quest categories

Quest markers keep their own code path (`QuestMarker`, `visibleQuestMarkers`). They gain a
`category` from `objectiveType` via `questCategory(objectiveType)` in `questLayer.ts`:
`visit`, `questItem` (`findQuestItem`), `mark`, `item` (the existing `ITEM_TYPES` set), `other`.
Filter keys are `quests/<category>`.

## Filter state

Two new settings in `Settings`:

```ts
layerFilters: Record<string, boolean>;   // key: "<group>" or "<group>/<category>"
hiddenQuests: Record<string, true>;      // task ids hidden with the eye toggle
```

`mergeSettings` accepts `layerFilters` only if it is a plain object whose values are all booleans,
keeps at most 500 keys, and each key matches `/^[a-z]+(\/[a-z0-9_-]+)?$/i`. `hiddenQuests` must be a
plain object whose values are all `true`; at most 2000 keys. Anything else resets to `{}`.

Resolution (`src/lib/layers/filters.ts`, pure):

```ts
export const DEFAULT_ON: ReadonlySet<string> = new Set([
  "extracts/pmc", "extracts/shared", "extracts/transit",
  "quests/visit", "quests/questItem", "quests/mark", "quests/item", "quests/other",
]);
export function isOn(filters: Record<string, boolean>, group: string, category: string): boolean;
```

`isOn` checks `filters["group/category"]`, then `filters["group"]`, then `DEFAULT_ON`. Setting a
group key writes that key and deletes every `group/*` key so the group toggle wins. Setting a
category key writes only that key. Group state for the UI is `groupState(filters, group,
categories) => "all" | "none" | "some"`.

These defaults mirror what the user sees in TarkovQuestie on first launch: extracts and quest
markers on, loot and spawns off.

## UI

### FilterPanel (`src/lib/layers/FilterPanel.svelte`)

Sits at the top of the sidebar, above `RoomPanel`. Replaces the "extracts" checkbox in the topbar.

- Search box: filters visible category rows by label (case-insensitive substring).
- One collapsible section per group in this order: Extracts, Map Tasks (quests), Spawns, Containers
  (loot), Locks, Hazards, Switches, BTR. Groups with zero points on the current map still render, with
  `[0/0]`, so users learn they exist.
- Section header: disclosure triangle, tri-state checkbox (`indeterminate` when `some`), group label,
  `[shown/total]` count for the current map.
- Category row: checkbox, glyph in the group colour, label, `[shown/total]` for the current map.
  `shown` counts points whose category is on; `total` counts all points in that category on this map.
- Collapsed state is UI-only (not persisted), default: Extracts and Map Tasks expanded.

### QuestPanel changes

- Quests grouped by trader in a fixed order: Prapor, Therapist, Skier, Peacekeeper, Mechanic,
  Ragman, Jaeger, Fence, Lightkeeper, Ref, BTR Driver, then any other trader alphabetically.
- Trader header: disclosure triangle, name, `done/total` counts. Collapsed state UI-only; all
  expanded by default. Empty groups after filtering are hidden.
- Sorting inside a group: quests with markers on the current map first, then by `minPlayerLevel`,
  then name.
- Each row: done checkbox, name, `lvl N`, `N here` when it has markers on the current map, and an
  eye toggle button (`aria-pressed`) that flips `hiddenQuests[task.id]`. Hidden quests render dimmed
  and their markers are excluded from the map.
- Existing search, level input, and hide done stay. Search also matches trader name.
- Grouping and sorting live in a pure `groupByTrader(tasks, opts)` in `src/lib/quests/grouping.ts`.

### Map (`MapView.svelte`)

- New prop `points: MapPoint[]` (already filtered for map and toggles). Replaces `extracts` and
  `showExtracts`. `ExtractMarker`, `extractExtracts`, `extractDivIcon` are deleted.
- One `L.LayerGroup` for points. `loot` and `spawns` points render as `L.circleMarker` (radius 4) on a
  shared `L.canvas()` renderer because a busy map has over a thousand of them; every other group uses
  `L.divIcon` with a glyph and the CSS classes `point-icon <group> <category>`.
- Glyphs: extracts `⇲`, spawns `✦`, locks `🔒`, hazards `☢`, switches `⏻`, btr `⛟`. Colours in
  `map.css`: extracts pmc green, scav orange, shared blue, transit purple; spawns pmc yellow, scav
  orange, boss red, sniper white; loot tan; locks grey; hazards red; switches cyan; btr olive.
- Every point has a tooltip with its escaped name. Quest markers keep their popup.

### App.svelte wiring

```ts
const allPoints   = $derived(app.questData ? extractPoints(app.questData) : []);
const mapPoints   = $derived(def ? allPoints.filter(p => p.mapKey === def.key) : []);
const points      = $derived(mapPoints.filter(p => isOn(settings.layerFilters, p.group, p.category)));
const questMarkers = $derived(visibleQuestMarkers(all, def.key, app.doneQuests, level)
                       .filter(m => !settings.hiddenQuests[m.taskId] && isOn(filters, "quests", m.category)));
```

Filter and hidden-quest changes go through `patchSettings`.

## Error handling

- Missing or null arrays from the API or an old snapshot: treated as `[]`, never throw.
- Corrupt `layerFilters` or `hiddenQuests` in the store: reset to `{}` by `mergeSettings`.
- Saving filters while settings have not loaded: impossible, the panel only renders once
  `settings` is non-null (existing pattern).

## Testing

- `points.test.ts`: fixture `QuestData` with one map containing every field; asserts categories,
  names, skipped null positions, fallback ids, `filterKey`.
- `filters.test.ts`: `isOn` precedence (category over group over default), `groupState`, and that
  setting a group key clears its category keys.
- `store.test.ts`: `mergeSettings` accepts valid maps, rejects non-boolean values, caps key counts,
  rejects bad keys.
- `grouping.test.ts`: trader order, sort within group, hidden and done handling, search over trader
  name.
- `questLayer.test.ts`: `questCategory` mapping.
- `cache.test.ts`: `isQuestData` rejects data without the current `schemaVersion`.
- Existing tests updated for the removed extract props.
- Manual: Streets with Containers all on pans without stutter; toggles survive a restart.

## Out of scope

Hidden stashes and loose loot (no data source), hideout, trading, player stats, per-map filter
memory, map label toggles (labels are baked into the SVGs), battlepass documents.

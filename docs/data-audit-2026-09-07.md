# tarkov.dev data audit, 2026-09-07

What the app draws from tarkov.dev was checked field by field against the live files at
`https://json.tarkov.dev/regular/` (and `/pve/`), against tarkov.dev's own map page source
(`src/pages/map/index.jsx`), against the map definitions in `the-hideout/tarkov-dev`
`src/data/maps.json`, and, for extracts, against an independent map site (eftguide.app) and the
history of the bundled snapshot in this repository. Game installed while checking: 1.1.0.1.46911.

## Result

- `data/snapshot/*.json` is byte-identical to what the adapter produces from today's upstream files
  (PvP and PvE list the same extracts). `data/maps.json` is identical to upstream for every
  interactive map: transforms, bounds, floors, landmark labels.
- Every upstream field that tarkov.dev's map draws is drawn here, with the same classification:
  spawns (PMC, Scav, sniper, boss, and the bosses that get their own row), extracts with switches and
  required items, transits with conditions, containers, loose loot by handbook category, locks with
  key and power, hazards plus artillery as mortar zones, switches with what they act on, stationary
  guns, BTR stops. Season event spawns (`season01`) and `sides: none` spawns are skipped exactly as
  tarkov.dev skips them.
- Quests: all 515 tasks, 1,442 objectives. Every `findQuestItem` objective that upstream places
  (109 of 110) is drawn from its `possibleLocations`; every zone (446 objectives) is drawn with its
  outline and height. Every quest item's picture resolves at `assets.tarkov.dev/<id>-base-image.webp`
  (checked for all 135). Every per-objective key requirement is already in the task's `neededKeys`
  (0 misses). Extract objectives already name their extract in the description; the raw `exitName`
  adds nothing.
- The one objective upstream leaves nowhere is "Peaceful Atom" (Icebreaker); it has no zone or
  spawn point upstream either.

## Extracts

`data/extracts.json` stands. The regeneration tarkov.dev ran on 2026-09-06 is still what upstream
serves today. None of the names it added was on tarkov.dev's own list in any of the seven snapshots
this repository bundled between 2026-09-04 and 2026-09-06, and each has a mark of its own:

| Map | Upstream name | Why it is left off |
| --- | --- | --- |
| Ground Zero | UN Roadblock, Scav Bunker | Woods' extracts at Woods' coordinates. |
| Ground Zero | Pinewood Basement (Co-Op) | Streets' extract at Streets' coordinates. |
| Streets | Basement Entrance | Same spot as Entrance to Catacombs, to the centimetre. |
| Streets | Scav Checkpoint | Key `E6`, the one number missing from the map's E1 to E9 exits; on no independent list. |
| Shoreline | Cliff Descent | Reserve's extract (key `Alpinist`), placed 18 m from Climber's Trail. |
| Shoreline | Rock Passage | The 2018 to 2020 flare exit at the rocks Climber's Trail now uses, 14 m from it. One site (eftguide.app) still lists it; worth a look in a raid if green flares ever burn there. |
| Shoreline | Svetliy Dead End, CCP Temporary, Ruined House Fence | Scav exits of the 2018 to 2020 map; on no independent list. |
| Factory | Gate 2 | On no independent list; eftguide.app's Factory has the file's nine. |

The extracts the file restores (five on Lighthouse, D-2 and Armored Train on Reserve, Friendship
Bridge on Woods, Medical Block Elevator on The Lab, Railway Bridge on Shoreline) are on every
independent list and were on tarkov.dev's own until 2026-09-06.

Per-map counts by faction match eftguide.app on all eleven curated maps (Gate 3 on Factory counted
once there, twice here as PMC and Scav exits); `curatedExtracts.test.ts` pins that roster.
`npm run snapshot` now prints, next to each left-off name, whose spot it sits on, so a real new
extract (a spot of its own) stands out from a misfiled or duplicated one.

## Gaps that cannot be closed from tarkov.dev

- Terminal and Icebreaker: upstream lists no extracts for either; other sites list one PMC exit
  each, without coordinates. The maps show none.
- Ground Zero's level bands (0 to 20, 21+) are upstream but not shown; the app folds the 21+ variant
  onto the one map, as it does Night Factory.

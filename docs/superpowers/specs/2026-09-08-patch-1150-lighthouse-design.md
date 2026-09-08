# Patch 1.1.5.0 (Lighthouse rework): what changes here, 2026-09-08

## What the patch changed and what tarkov.dev serves

Patch 1.1.5.0 went live on 2026-09-08. json.tarkov.dev regenerated its files at 14:34 UTC the same
day. Checked against the bundled snapshot (0.7.2), the regeneration carries part of the patch:

- Lighthouse bosses: the Rogue rows moved to `Zone_Chalet` (four) and `Zone_Rocks` (one) under a new
  mob id `exUsecFree`, which `maps_en` does not translate and whose portrait is the unknown-NPC
  placeholder. `ExUsec` (name "Rogue", rogue portrait) is still in the mob table but no map uses it.
  Knight keeps `Zone_Chalet` only. Glukhar is new at `Zone_Hellicopter` (water treatment), 100 %,
  three escorts; that zone gained boss spawn points. Two ordinary spawns were added.
- Icebreaker: `accessKeys` is now the "Sudak-Tudak marine repair kit".
- Tasks: still 515; 34 changed by item renames (the face masks that lost their armour) and map-list
  order. None of the new tasks (To the Light, Pay the Fare!, Can't Drink Away Skill) is listed yet.
- Not yet reflected upstream: the stationary weapons (8) and landmines (158) the patch removed from
  the water treatment plant, the Icebreaker transit at the pier, the BTR route, the moved Marked Room
  and Prapor's camp, and the Lighthouse SVG (unchanged since 2025-11-03).
- Extracts: unchanged upstream; `data/extracts.json` still restores the same five.

## Decisions (asked 2026-09-08)

1. Water treatment guns and mines: draw what tarkov.dev serves; no curated hide list. Upstream
   regenerates daily from game files.
2. Rogue naming: alias `exUsecFree` to the `ExUsec` mob locally, so the map card reads "Rogue" with the
   rogue portrait and merges with any remaining Rogue rows (summarizeBosses keys by normalizedName).
3. Commit to main only; no release, no build.

## Design

`jsonSource.ts` `toMap`: a `MOB_ALIASES` table (`exUsecFree` -> `ExUsec`) consulted before the mob
table lookup, falling back to the raw id when the target mob is absent. Test in `jsonSource.test.ts`
with a fixture boss under the alias id. Snapshot regenerated (`npm run snapshot`) so the bundled data
carries the regeneration; `itemCategories.json` refreshes with it. Changelog entry under Unreleased.

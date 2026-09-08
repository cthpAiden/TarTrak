// The extracts each map really has, checked against sources independent of tarkov.dev, so that an
// upstream data accident never redraws a map. On 2026-09-06 json.tarkov.dev regenerated its map files
// with five of Lighthouse's thirteen extracts gone (the V-Ex among them), Reserve without D-2 and the
// train, Woods without Friendship Bridge, and other maps' extracts filed under the wrong map (Woods'
// UN Roadblock on Ground Zero, Customs' Scav Checkpoint on Streets), while its API was down and the
// game had not changed. data/extracts.json is the list; `npm run snapshot` reports what it restores
// and what upstream lists that the file does not, so it can follow a patch that changes a map.
import extracts from "../../../data/extracts.json" with { type: "json" };
import type { MapExtract } from "./types";

/** A curated entry; `pinned` makes the file's spot win over upstream's (a patch moved it, upstream lags). */
export type CuratedExtract = MapExtract & { pinned?: true };
/** Extracts by map normalizedName; a map absent from the file takes tarkov.dev's list as it comes. */
export type CuratedExtracts = Record<string, CuratedExtract[]>;
export const CURATED_EXTRACTS = extracts as unknown as CuratedExtracts;

/**
 * The curated names, each as upstream lists it when it does (so a spot that moved or an extract
 * opened to Scavs shows without touching the file), else as the file has it. A pinned name is the
 * exception: the file's entry replaces every upstream entry of that name. An upstream name the
 * file does not know is left off: that is how the misfiled extracts of September 2026 looked.
 * Without a curated list, upstream stands as it is.
 */
export function mergeExtracts(upstream: MapExtract[], curated: CuratedExtract[] | undefined): MapExtract[] {
  if (!curated?.length) return upstream;
  const known = new Set(curated.map((e) => e.name));
  const pinned = new Set(curated.filter((e) => e.pinned).map((e) => e.name));
  const kept = upstream.filter((e) => known.has(e.name) && !pinned.has(e.name));
  const listed = new Set(kept.map((e) => e.name));
  return [...kept, ...curated.filter((e) => !listed.has(e.name)).map(({ pinned: _pinned, ...e }) => e)];
}

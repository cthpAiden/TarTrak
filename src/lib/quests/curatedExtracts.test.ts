import { describe, it, expect } from "vitest";
import { CURATED_EXTRACTS, mergeExtracts } from "./curatedExtracts";
import type { MapExtract } from "./types";

const ex = (name: string, faction = "pmc", x = 0): MapExtract => ({ id: `${name}/${faction}`, name, faction, position: { x, y: 0, z: 0 } });

describe("mergeExtracts", () => {
  it("appends the curated extracts upstream lacks, in the file's order", () => {
    const merged = mergeExtracts([ex("Gate 3")], [ex("D-2"), ex("Gate 3"), ex("Armored Train", "shared")]);
    expect(merged.map((e) => e.name)).toEqual(["Gate 3", "D-2", "Armored Train"]);
  });

  it("keeps upstream's entries for a name it lists, even under another faction or spot", () => {
    const merged = mergeExtracts([ex("Railway Exfil", "pmc", 1), ex("Railway Exfil", "scav", 2)], [ex("Railway Exfil", "shared", 3)]);
    expect(merged).toEqual([ex("Railway Exfil", "pmc", 1), ex("Railway Exfil", "scav", 2)]);
  });

  it("replaces upstream's entries of a pinned name with the file's, pinned flag stripped", () => {
    const pinned = { ...ex("Mountain Pass", "pmc", 3), pinned: true as const };
    const merged = mergeExtracts([ex("Mountain Pass", "pmc", 1), ex("Mountain Pass", "scav", 2), ex("Gate 3")], [pinned, ex("Gate 3")]);
    expect(merged).toEqual([ex("Gate 3"), ex("Mountain Pass", "pmc", 3)]);
  });

  it("leaves off an upstream name the file does not know", () => {
    const merged = mergeExtracts([ex("UN Roadblock"), ex("Mira Ave (Flare)")], [ex("Mira Ave (Flare)", "pmc", 9)]);
    expect(merged).toEqual([ex("Mira Ave (Flare)")]);
  });

  it("returns upstream untouched without a curated list", () => {
    const upstream = [ex("Gate 3")];
    expect(mergeExtracts(upstream, undefined)).toBe(upstream);
    expect(mergeExtracts(upstream, [])).toBe(upstream);
  });
});

describe("data/extracts.json", () => {
  it("places every extract with an id, a name and a known faction, on main maps only", () => {
    expect(Object.keys(CURATED_EXTRACTS).length).toBeGreaterThan(8);
    for (const [map, list] of Object.entries(CURATED_EXTRACTS)) {
      expect(map).not.toMatch(/night-factory|ground-zero-21|the-lab-dark|tutorial/);
      expect(list.length, map).toBeGreaterThan(0);
      for (const e of list) {
        expect(e.id, `${map} ${e.name}`).toBeTruthy();
        expect(e.name, map).toBeTruthy();
        expect(["pmc", "scav", "shared"], `${map} ${e.name}`).toContain(e.faction);
        expect(e.position, `${map} ${e.name}`).not.toBeNull();
      }
      const keys = list.map((e) => `${e.name}|${e.faction}`);
      expect(new Set(keys).size, map).toBe(keys.length);
    }
  });

  it("holds the roster of 2026-09-07: tarkov.dev's lists before its regeneration, matched to eftguide.app map by map", () => {
    const roster: Record<string, string> = {
      factory: "pmc 6, scav 3",
      customs: "pmc 9, scav 16, shared 2",
      woods: "pmc 9, scav 10, shared 1",
      lighthouse: "pmc 6, scav 5, shared 2",
      shoreline: "pmc 8, scav 5, shared 1",
      reserve: "pmc 3, scav 4, shared 4",
      interchange: "pmc 6, scav 1, shared 2",
      "streets-of-tarkov": "pmc 10, scav 6, shared 1",
      "the-lab": "pmc 4, shared 3",
      "ground-zero": "pmc 3, shared 3",
      "the-labyrinth": "pmc 2",
    };
    expect(Object.keys(CURATED_EXTRACTS).sort()).toEqual(Object.keys(roster).sort());
    for (const [map, list] of Object.entries(CURATED_EXTRACTS)) {
      const counts = new Map<string, number>();
      for (const e of list) counts.set(e.faction, (counts.get(e.faction) ?? 0) + 1);
      const summary = [...counts].sort().map(([faction, n]) => `${faction} ${n}`).join(", ");
      expect(summary, map).toBe(roster[map]);
    }
  });

  it("knows the extracts tarkov.dev dropped in September 2026, not the ones it misfiled", () => {
    const names = (map: string) => CURATED_EXTRACTS[map].map((e) => `${e.name} (${e.faction})`);
    for (const n of [
      "Road to Military Base V-Ex (pmc)",
      "Side Tunnel (Co-Op) (shared)",
      "Southern Road (pmc)",
      "Hideout Under the Landing Stage (scav)",
      "Industrial Zone Gates (scav)",
    ]) {
      expect(names("lighthouse")).toContain(n);
    }
    expect(names("reserve")).toContain("D-2 (pmc)");
    expect(names("reserve")).toContain("Armored Train (shared)");
    expect(names("woods")).toContain("Friendship Bridge (Co-Op) (shared)");
    expect(names("the-lab")).toContain("Medical Block Elevator (shared)");
    const vex = CURATED_EXTRACTS.lighthouse.find((e) => e.name === "Road to Military Base V-Ex")!;
    expect(vex.requiredItem).toEqual({ name: "Roubles", count: 20000, image: "5449016a4bdc2d6f028b456f" });
    expect(vex.outline?.length).toBeGreaterThanOrEqual(3);
    // Filed under the wrong map by that regeneration: Woods', Streets' and Customs' extracts.
    for (const n of ["UN Roadblock", "Scav Bunker", "Pinewood Basement (Co-Op)"]) expect(names("ground-zero").join()).not.toContain(n);
    for (const n of ["Scav Checkpoint", "Basement Entrance"]) expect(names("streets-of-tarkov").join()).not.toContain(n);
    expect(names("factory").join()).not.toContain("Gate 2");
  });

  // Patch 1.1.5.0 (2026-09-08) moved it north of Pikes Peak Resort; tarkov.dev still lists the old spot.
  it("pins Lighthouse's Mountain Pass at its post-rework spot so it wins over upstream", () => {
    const mp = CURATED_EXTRACTS.lighthouse.find((e) => e.name === "Mountain Pass")!;
    expect(mp.pinned).toBe(true);
    expect(mp.position).toEqual({ x: -182, y: 41.89, z: -71 });
    expect(mp.outline).toHaveLength(4);
    expect(CURATED_EXTRACTS.lighthouse.filter((e) => e.pinned)).toHaveLength(1);
  });
});

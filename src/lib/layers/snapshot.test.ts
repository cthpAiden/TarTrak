// Guards the shipped data set: every entry tarkov.dev publishes with a position must become a point,
// every extract must land in a known, default-visible category, and the maps stay recognisable.
import { describe, it, expect } from "vitest";
import snapshot from "../../../data/snapshot/maps.json";
import tasksSnapshot from "../../../data/snapshot/tasks.json";
import type { MapInfo, QuestTask } from "../quests/types";
import { extractQuestMarkers } from "../quests/markers";
import { extractPoints, categoryLabel, CATEGORY_LABELS } from "./points";
import { isOn } from "./filters";
import { getMapDef, primaryMapKey } from "../map/mapsData";

const maps = snapshot as unknown as MapInfo[];
const tasks = tasksSnapshot as unknown as QuestTask[];
const points = extractPoints({ schemaVersion: 0, fetchedAt: 0, tasks: [], maps });
const KNOWN_FACTIONS = ["pmc", "scav", "shared"];
const placed = <T extends { position: unknown }>(list: T[] | null | undefined) => (list ?? []).filter((e) => e.position);

describe("data snapshot", () => {
  it("covers the playable maps", () => {
    const keys = maps.map((m) => m.normalizedName);
    for (const k of ["customs", "factory", "woods", "shoreline", "interchange", "reserve", "lighthouse", "streets-of-tarkov", "the-lab", "ground-zero"]) {
      expect(keys).toContain(k);
    }
  });

  it("turns every placed extract, transit, container, loot spot, lock, hazard, switch, gun and BTR stop into a point", () => {
    for (const m of maps) {
      if (primaryMapKey(m.normalizedName) !== m.normalizedName) continue; // variants: below
      const variants = getMapDef(m.normalizedName)?.altKeys ?? [];
      const mine = points.filter((p) => p.mapKey === m.normalizedName && !variants.some((v) => p.id.startsWith(`${v}/`)));
      const count = (group: string, not?: string) => mine.filter((p) => p.group === group && p.category !== not).length;
      expect(count("extracts", "transit"), `${m.normalizedName} extracts`).toBe(placed(m.extracts).length);
      expect(mine.filter((p) => p.group === "extracts" && p.category === "transit").length, `${m.normalizedName} transits`).toBe(placed(m.transits).length);
      expect(count("loot"), `${m.normalizedName} containers`).toBe(placed(m.lootContainers).length);
      expect(count("lootLoose"), `${m.normalizedName} loose loot`).toBe(placed(m.lootLoose).length);
      expect(count("locks"), `${m.normalizedName} locks`).toBe(placed(m.locks).length);
      expect(count("hazards"), `${m.normalizedName} hazards`).toBe(placed(m.hazards).length);
      expect(count("switches"), `${m.normalizedName} switches`).toBe(placed(m.switches).length);
      expect(count("guns"), `${m.normalizedName} guns`).toBe(placed(m.stationaryWeapons).length);
      expect(count("btr"), `${m.normalizedName} btr`).toBe(placed(m.btrStations).length);
    }
  });

  it("folds each variant's own spots onto its map without doubling shared ones", () => {
    for (const m of maps) {
      const key = primaryMapKey(m.normalizedName);
      if (key === m.normalizedName) continue;
      const own = points.filter((p) => p.id.startsWith(`${m.normalizedName}/`));
      expect(own.every((p) => p.mapKey === key), m.normalizedName).toBe(true);
      const at = (p: { group: string; category: string; x: number; y: number; z: number }) => `${p.group}|${p.category}|${p.x}|${p.y}|${p.z}`;
      const base = new Set(points.filter((p) => p.mapKey === key && !own.includes(p)).map(at));
      expect(own.filter((p) => base.has(at(p))), m.normalizedName).toEqual([]);
    }
    // Night Factory and Ground Zero 21+ carry loot spots and a boss the day/low-level variant lacks.
    expect(points.some((p) => p.id.startsWith("night-factory/lootLoose/"))).toBe(true);
    expect(points.some((p) => p.id.startsWith("ground-zero-21/spawns/cultist-priest/"))).toBe(true);
    expect(points.some((p) => p.mapKey === "night-factory" || p.mapKey === "ground-zero-21" || p.mapKey === "the-lab-dark")).toBe(false);
  });

  // Night Factory's extracts are Factory's under the same names, a rounding error apart and without a faction.
  it("does not draw a variant's extracts a second time on its map", () => {
    const factory = points.filter((p) => p.mapKey === "factory" && p.group === "extracts" && p.category !== "transit");
    expect(factory.length).toBe(maps.find((m) => m.normalizedName === "factory")!.extracts.length);
    expect(points.filter((p) => p.group === "extracts" && /^(night-factory|ground-zero-21)\//.test(p.id))).toEqual([]);
  });

  it("sorts loose loot into the handbook category rows tarkov.dev uses", () => {
    const customs = points.filter((p) => p.mapKey === "customs" && p.group === "lootLoose");
    const rows = new Set(customs.flatMap((p) => p.categories ?? [p.category]));
    expect(rows.size).toBeGreaterThan(5);
    expect(rows.has("other")).toBe(false);
    for (const key of ["barter-items", "medical-supplies", "keys", "mechanical-keys"]) if (rows.has(key)) expect(categoryLabel(`lootLoose/${key}`, customs)).not.toBe(key);
    expect(customs.some((p) => (p.categories?.length ?? 0) > 1)).toBe(true);
  });

  it("carries tarkov.dev's raid info, entry keys and boss details", () => {
    const customs = maps.find((m) => m.normalizedName === "customs")!;
    expect(customs.raidDuration).toBe(35);
    expect(customs.players).toBe("10-12");
    expect(customs.accessKeys).toBeUndefined();
    const reshala = customs.bosses!.find((b) => b.normalizedName === "reshala")!;
    expect(reshala.escorts).toBe(4);
    expect(reshala.portrait?.startsWith("https://assets.tarkov.dev/")).toBe(true);
    expect(maps.find((m) => m.normalizedName === "the-lab")!.accessKeys).toEqual(["TerraGroup Labs access keycard"]);
    // The boss spawn popup names the boss with its chance and escort.
    const dorms = points.find((p) => p.mapKey === "customs" && p.group === "spawns" && p.category === "boss" && p.name.startsWith("Reshala"))!;
    expect(dorms.details).toContain("Reshala: 60%, 4 guards");
  });

  it("carries quest factions, rewards, trader level gates and fail conditions", () => {
    const byFaction = (f: string) => tasks.filter((t) => t.faction === f);
    expect(byFaction("USEC").length).toBe(6);
    expect(byFaction("BEAR").length).toBe(6);
    expect(tasks.filter((t) => t.faction && t.faction !== "USEC" && t.faction !== "BEAR")).toEqual([]);
    const shortage = tasks.find((t) => t.name === "Shortage")!;
    expect(shortage.experience).toBeGreaterThan(0);
    expect(shortage.rewards?.items?.[0].name).toBe("Roubles");
    expect(shortage.objectives.map((o) => [o.count, o.foundInRaid])).toEqual([[3, true], [3, true]]);
    expect(tasks.filter((t) => t.traderLevels?.length).length).toBeGreaterThan(50);
    expect(tasks.find((t) => t.name === "Big Customer")!.failsOn).toEqual(["Chemical - Part 4", "Out of Curiosity"]);
  });

  it("draws single-item loot spots as their item and lists key pictures on locks", () => {
    const customs = points.filter((p) => p.mapKey === "customs");
    const loose = customs.filter((p) => p.group === "lootLoose");
    const pictured = loose.filter((p) => p.icon?.includes("-base-image.webp"));
    expect(pictured.length).toBeGreaterThan(100);
    expect(pictured.every((p) => p.details.length === 1)).toBe(true);
    expect(loose.some((p) => p.icon?.includes("handbook-category-"))).toBe(true);
    expect(customs.filter((p) => p.group === "locks" && p.image).length).toBeGreaterThan(10);
    for (const p of customs) for (const url of [p.icon, p.image]) if (url) expect(url.startsWith("https://assets.tarkov.dev/")).toBe(true);
  });

  it("knows every extract faction, labels it, and shows PMC-usable extracts by default", () => {
    for (const m of maps) {
      for (const e of m.extracts) {
        expect(KNOWN_FACTIONS, `${m.normalizedName} ${e.name}`).toContain(e.faction);
        expect(CATEGORY_LABELS[`extracts/${e.faction}`], e.faction).toBeDefined();
        if (e.faction !== "scav") expect(isOn({}, "extracts", e.faction), `${m.normalizedName} ${e.name}`).toBe(true);
      }
    }
  });

  it("has a PMC-usable extract on every map that has extracts at all", () => {
    for (const m of maps) {
      if (m.extracts.length === 0) continue;
      expect(m.extracts.some((e) => e.faction === "pmc" || e.faction === "shared"), m.normalizedName).toBe(true);
    }
  });

  it("lists all nine Interchange extracts, Emercom and both Railway included", () => {
    const ic = maps.find((m) => m.normalizedName === "interchange")!;
    // Railway Exfil is one spot for PMCs and another for Scavs, so it is listed twice, like on tarkov.dev.
    expect(ic.extracts.map((e) => `${e.name} (${e.faction})`).sort()).toEqual(
      [
        "Emercom Checkpoint (shared)",
        "Hole in the Fence (pmc)",
        "Path to River (Flare) (pmc)",
        "Power Station V-Ex (pmc)",
        "Railway Exfil (pmc)",
        "Railway Exfil (scav)",
        "Saferoom Exfil (pmc)",
        "Scav Camp (Co-Op) (shared)",
        "Smugglers' Tunnel (pmc)",
      ].sort(),
    );
    const byName = (n: string) => points.find((p) => p.mapKey === "interchange" && p.name === n)!;
    // Both are "shared" to tarkov.dev, but only one of them needs a Scav standing next to you.
    expect(byName("Scav Camp (Co-Op)").category).toBe("coop");
    expect(byName("Emercom Checkpoint").category).toBe("shared");
    expect(isOn({}, "extracts", "coop")).toBe(true);
    const usable = points.filter((p) => p.mapKey === "interchange" && p.group === "extracts" && isOn({}, p.group, p.category));
    expect(usable.map((p) => p.name)).toContain("Emercom Checkpoint");
    expect(usable.map((p) => p.name)).toContain("Railway Exfil");
    expect(ic.extracts.find((e) => e.name === "Power Station V-Ex")!.requiredItem).toEqual({ name: "Roubles", count: 20000, image: "5449016a4bdc2d6f028b456f" });
    expect(ic.switches?.map((s) => s.name)).toContain("Saferoom Exfil Switch");
  });

  it("draws quest item spawn points as well as objective zones, Lighthouse included", () => {
    const qm = extractQuestMarkers({ schemaVersion: 0, fetchedAt: 0, tasks, maps });
    const lighthouse = qm.filter((m) => m.mapKey === "lighthouse");
    // tarkov.dev's map shows well over a hundred item spawn points on Lighthouse alone.
    expect(lighthouse.filter((m) => m.itemName).length).toBeGreaterThan(50);
    expect(lighthouse.some((m) => m.category === "visit")).toBe(true);
    for (const m of qm.filter((m) => m.itemName)) expect(m.itemName, m.taskName).not.toMatch(/ Name$/);
  });

  // tarkov.dev's September 2026 data regeneration dropped these; data/extracts.json keeps them on the map.
  it("lists all thirteen Lighthouse extracts, the V-Ex included, and draws them", () => {
    const lh = maps.find((m) => m.normalizedName === "lighthouse")!;
    expect(lh.extracts.map((e) => `${e.name} (${e.faction})`).sort()).toEqual(
      [
        "Armored Train (shared)",
        "Hideout Under the Landing Stage (scav)",
        "Industrial Zone Gates (scav)",
        "Mountain Pass (pmc)",
        "Northern Checkpoint (pmc)",
        "Passage by the Lake (pmc)",
        "Path to Shoreline (pmc)",
        "Path to Shoreline (scav)",
        "Road to Military Base V-Ex (pmc)",
        "Scav Hideout at the Grotto (scav)",
        "Side Tunnel (Co-Op) (shared)",
        "Southern Road (pmc)",
        "Southern Road Landslide (scav)",
      ].sort(),
    );
    const vex = points.find((p) => p.mapKey === "lighthouse" && p.name === "Road to Military Base V-Ex")!;
    expect(vex.category).toBe("pmc");
    expect(vex.details).toContain("Requires Roubles ×20,000");
    expect(vex.image).toMatch(/5449016a4bdc2d6f028b456f/);
    expect(vex.outline?.length).toBe(4);
    expect(isOn({}, vex.group, vex.category)).toBe(true);
    expect(points.find((p) => p.mapKey === "lighthouse" && p.name === "Side Tunnel (Co-Op)")!.category).toBe("coop");
    const woods = maps.find((m) => m.normalizedName === "woods")!;
    expect(woods.extracts.map((e) => e.name)).toContain("Friendship Bridge (Co-Op)");
    const lab = maps.find((m) => m.normalizedName === "the-lab")!;
    expect(lab.extracts.map((e) => e.name)).toContain("Medical Block Elevator");
  });

  // The same regeneration filed other maps' extracts under Ground Zero, Streets, Shoreline and Factory.
  it("leaves off the extracts tarkov.dev misfiled, on the map and its variants", () => {
    const names = (key: string) => points.filter((p) => p.mapKey === key && p.group === "extracts").map((p) => p.name);
    for (const n of ["UN Roadblock", "Scav Bunker", "Pinewood Basement (Co-Op)"]) expect(names("ground-zero")).not.toContain(n);
    for (const n of ["Scav Checkpoint", "Basement Entrance"]) expect(names("streets-of-tarkov")).not.toContain(n);
    for (const n of ["Cliff Descent", "CCP Temporary", "Rock Passage"]) expect(names("shoreline")).not.toContain(n);
    expect(names("factory")).not.toContain("Gate 2");
    expect(names("woods")).toContain("UN Roadblock");
    expect(names("reserve")).toContain("Cliff Descent");
  });

  it("lists Reserve's extracts with their item, and its quest markers", () => {
    const rb = maps.find((m) => m.normalizedName === "reserve")!;
    const names = rb.extracts.map((e) => e.name).sort();
    for (const n of ["Bunker Hermetic Door", "Cliff Descent", "Scav Lands (Co-Op)", "Sewer Manhole", "Exit to Woods", "D-2", "Armored Train"]) {
      expect(names, n).toContain(n);
    }
    expect(rb.extracts.find((e) => e.name === "Exit to Woods")!.requiredItem?.name).toMatch(/Minefield map/);
    const usable = points.filter((p) => p.mapKey === "reserve" && p.group === "extracts" && isOn({}, p.group, p.category)).map((p) => p.name);
    for (const n of ["Bunker Hermetic Door", "Cliff Descent", "Sewer Manhole"]) expect(usable).toContain(n);
    expect(points.find((p) => p.mapKey === "reserve" && p.name === "Scav Lands (Co-Op)")!.category).toBe("coop");
    const qm = extractQuestMarkers({ schemaVersion: 0, fetchedAt: 0, tasks, maps }).filter((m) => m.mapKey === "reserve");
    expect(qm.filter((m) => m.itemName).length).toBeGreaterThan(10);
    expect(qm.filter((m) => !m.itemName).length).toBeGreaterThan(10);
  });

  it("names every switch and hazard in plain English, not a translation key", () => {
    for (const m of maps) {
      for (const sw of m.switches ?? []) expect(sw.name, m.normalizedName).not.toMatch(/^switch_/);
      for (const h of m.hazards ?? []) expect(h.name, m.normalizedName).not.toMatch(/\//);
    }
    const labs = maps.find((m) => m.normalizedName === "factory")!;
    expect(labs.transits?.find((t) => t.conditions)?.conditions).toMatch(/keycard/);
  });
});

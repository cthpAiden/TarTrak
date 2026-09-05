// Guards the shipped data set: every entry tarkov.dev publishes with a position must become a point,
// every extract must land in a known, default-visible category, and the maps stay recognisable.
import { describe, it, expect } from "vitest";
import snapshot from "../../../data/snapshot/maps.json";
import tasksSnapshot from "../../../data/snapshot/tasks.json";
import type { MapInfo, QuestTask } from "../quests/types";
import { extractQuestMarkers } from "../quests/markers";
import { extractPoints, CATEGORY_LABELS } from "./points";
import { isOn } from "./filters";

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
      const mine = points.filter((p) => p.mapKey === m.normalizedName);
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

  it("lists all six Interchange extracts, Emercom and Railway included", () => {
    const ic = maps.find((m) => m.normalizedName === "interchange")!;
    expect(ic.extracts.map((e) => e.name).sort()).toEqual(
      ["Emercom Checkpoint", "Hole in the Fence", "Power Station V-Ex", "Railway Exfil", "Saferoom Exfil", "Scav Camp (Co-Op)"].sort(),
    );
    const byName = (n: string) => points.find((p) => p.mapKey === "interchange" && p.name === n)!;
    // Both are "shared" to tarkov.dev, but only one of them needs a Scav standing next to you.
    expect(byName("Scav Camp (Co-Op)").category).toBe("coop");
    expect(byName("Emercom Checkpoint").category).toBe("shared");
    expect(isOn({}, "extracts", "coop")).toBe(true);
    const usable = points.filter((p) => p.mapKey === "interchange" && p.group === "extracts" && isOn({}, p.group, p.category));
    expect(usable.map((p) => p.name)).toContain("Emercom Checkpoint");
    expect(usable.map((p) => p.name)).toContain("Railway Exfil");
    const saferoom = ic.extracts.find((e) => e.name === "Saferoom Exfil")!;
    expect(saferoom.switches?.length).toBe(1);
    expect(ic.extracts.find((e) => e.name === "Power Station V-Ex")!.requiredItem).toEqual({ name: "Roubles", count: 20000 });
    expect(ic.switches?.find((s) => s.name === "Saferoom Exfil Switch")?.activates).toEqual([{ operation: "Unlock", target: "Saferoom Exfil" }]);
  });

  it("draws quest item spawn points as well as objective zones, Lighthouse included", () => {
    const qm = extractQuestMarkers({ schemaVersion: 0, fetchedAt: 0, tasks, maps });
    const lighthouse = qm.filter((m) => m.mapKey === "lighthouse");
    // tarkov.dev's map shows well over a hundred item spawn points on Lighthouse alone.
    expect(lighthouse.filter((m) => m.itemName).length).toBeGreaterThan(50);
    expect(lighthouse.some((m) => m.category === "visit")).toBe(true);
    for (const m of qm.filter((m) => m.itemName)) expect(m.itemName, m.taskName).not.toMatch(/ Name$/);
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

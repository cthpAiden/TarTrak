import { describe, it, expect } from "vitest";
import { raidLine, summarizeBosses } from "./mapInfo";
import type { MapBoss } from "../quests/types";

const boss = (over: Partial<MapBoss> & Pick<MapBoss, "name" | "normalizedName" | "spawnChance">): MapBoss => ({ spawnKeys: [], ...over });

describe("summarizeBosses", () => {
  it("names each boss once at its best chance and biggest escort, likeliest first", () => {
    const out = summarizeBosses([
      boss({ name: "Rogue", normalizedName: "rogue", spawnChance: 0.5, escorts: 2 }),
      boss({ name: "Knight", normalizedName: "knight", spawnChance: 0.2, escorts: 2, portrait: "https://assets.tarkov.dev/knight-portrait.png" }),
      boss({ name: "Rogue", normalizedName: "rogue", spawnChance: 0.8, escorts: 1, portrait: "https://assets.tarkov.dev/rogue-portrait.webp" }),
      boss({ name: "Zryachiy", normalizedName: "zryachiy", spawnChance: 1 }),
      boss({ name: "Partisan", normalizedName: "partisan", spawnChance: 0.15 }),
    ]);
    expect(out).toEqual([
      { name: "Zryachiy", chance: 100 },
      { name: "Rogue", chance: 80, escorts: 2, portrait: "https://assets.tarkov.dev/rogue-portrait.webp" },
      { name: "Knight", chance: 20, escorts: 2, portrait: "https://assets.tarkov.dev/knight-portrait.png" },
      { name: "Partisan", chance: 15 },
    ]);
  });

  it("marks a boss as switch-spawned only when every one of its entries is", () => {
    const out = summarizeBosses([
      boss({ name: "Raider", normalizedName: "raider", spawnChance: 0.4 }),
      boss({ name: "Raider", normalizedName: "raider", spawnChance: 0.3, trigger: "Switch" }),
      boss({ name: "Wedge", normalizedName: "wedge", spawnChance: 0.4, trigger: "Switch" }),
      boss({ name: "Wedge", normalizedName: "wedge", spawnChance: 0.3, trigger: "Switch" }),
    ]);
    expect(out).toEqual([
      { name: "Raider", chance: 40 },
      { name: "Wedge", chance: 40, bySwitch: true },
    ]);
  });

  it("is empty for a map without bosses", () => {
    expect(summarizeBosses([])).toEqual([]);
  });
});

describe("raidLine", () => {
  it("joins the parts tarkov.dev gives", () => {
    expect(raidLine({ raidDuration: 35, players: "10-12" })).toBe("35 min · 10-12 players");
    expect(raidLine({ raidDuration: 20 })).toBe("20 min");
    expect(raidLine({})).toBe("");
  });
});

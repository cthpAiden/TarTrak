import { describe, it, expect } from "vitest";
import { resolveMapKey } from "./mapNames";

describe("resolveMapKey", () => {
  it.each([
    ["Lighthouse", "lighthouse"],
    ["lighthouse", "lighthouse"],
    ["TarkovStreets", "streets-of-tarkov"],
    ["city", "streets-of-tarkov"],
    ["bigmap", "customs"],
    ["factory4_day", "factory"],
    ["factory4_night", "factory"],
    ["Woods", "woods"],
    ["Shoreline", "shoreline"],
    ["Interchange", "interchange"],
    ["RezervBase", "reserve"],
    ["laboratory", "the-lab"],
    ["Sandbox", "ground-zero"],
    ["Sandbox_high", "ground-zero"],
    ["Labyrinth", "the-labyrinth"],
    ["Terminal", "terminal"],
  ])("%s -> %s", (input, expected) => {
    expect(resolveMapKey(input)).toBe(expected);
  });

  it("returns null for unknown names", () => {
    expect(resolveMapKey("hideout")).toBeNull();
    expect(resolveMapKey("")).toBeNull();
  });
});

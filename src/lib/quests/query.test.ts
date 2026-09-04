import { describe, it, expect } from "vitest";
import { fetchQuestData, QUEST_QUERY, QUEST_QUERY_MINIMAL } from "./query";
import { QUEST_SCHEMA_VERSION } from "./types";

const ok = JSON.stringify({ data: { tasks: [], maps: [] } });
const rejected = JSON.stringify({ errors: [{ message: 'Cannot query field "btrStations" on type "Map".' }] });

describe("fetchQuestData", () => {
  it("uses the full query when it is accepted", async () => {
    const sent: string[] = [];
    const d = await fetchQuestData(async (_u, body) => {
      sent.push((JSON.parse(body) as { query: string }).query);
      return ok;
    });
    expect(sent).toEqual([QUEST_QUERY]);
    expect(d.schemaVersion).toBe(QUEST_SCHEMA_VERSION);
  });

  it("falls back to the minimal query when the full one is rejected", async () => {
    const sent: string[] = [];
    await fetchQuestData(async (_u, body) => {
      sent.push((JSON.parse(body) as { query: string }).query);
      return sent.length === 1 ? rejected : ok;
    });
    expect(sent).toEqual([QUEST_QUERY, QUEST_QUERY_MINIMAL]);
  });

  it("throws when both queries are rejected", async () => {
    await expect(fetchQuestData(async () => rejected)).rejects.toThrow(/no data/);
  });

  it("minimal query has no layer fields", () => {
    expect(QUEST_QUERY_MINIMAL).not.toMatch(/lootContainers|spawns|btrStations/);
    expect(QUEST_QUERY).toMatch(/lootContainers/);
  });
});

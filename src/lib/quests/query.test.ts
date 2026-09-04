import { describe, it, expect } from "vitest";
import { fetchQuestData } from "./query";
import { JSON_FILES, JSON_TARKOV_DEV } from "./jsonSource";
import { QUEST_SCHEMA_VERSION } from "./types";

const bodies: Record<string, unknown> = {
  maps: { data: { maps: { m1: { id: "m1", name: "m1 Name", normalizedName: "factory" } }, lootContainers: {} } },
  maps_en: { data: { "m1 Name": "Factory" } },
  tasks: { data: { tasks: { t1: { id: "t1", name: "t1 name", trader: "tr1", map: null, objectives: [] } } } },
  tasks_en: { data: { "t1 name": "Debut" } },
  traders: { data: { tr1: { id: "tr1", name: "tr1 Nickname", normalizedName: "prapor" } } },
  traders_en: { data: { "tr1 Nickname": "Prapor" } },
  items_en: { data: { "k1 Name": "Factory emergency exit key" } },
};

const get = async (url: string): Promise<string> => {
  const name = url.slice(url.lastIndexOf("/") + 1);
  const body = bodies[name];
  if (!body) throw new Error(`unexpected url ${url}`);
  return JSON.stringify(body);
};

describe("fetchQuestData", () => {
  it("requests the seven json.tarkov.dev files and adapts them", async () => {
    const seen: string[] = [];
    const d = await fetchQuestData((url) => {
      seen.push(url);
      return get(url);
    });
    expect(seen).toHaveLength(7);
    expect(seen.sort()).toEqual(JSON_FILES.map((f) => `${JSON_TARKOV_DEV}/${f}`).sort());
    expect(d.schemaVersion).toBe(QUEST_SCHEMA_VERSION);
    expect(d.maps.map((m) => m.name)).toEqual(["Factory"]);
    expect(d.tasks.map((t) => t.name)).toEqual(["Debut"]);
    expect(d.tasks[0].trader.name).toBe("Prapor");
  });

  it("propagates a fetch failure", async () => {
    await expect(fetchQuestData(async () => { throw new Error("GET boom -> 500"); })).rejects.toThrow(/boom/);
  });

  it("propagates a parse failure", async () => {
    await expect(fetchQuestData(async () => "not json")).rejects.toThrow();
  });
});

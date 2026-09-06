import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { flushSync, mount, unmount } from "svelte";
import QuestPanel from "./QuestPanel.svelte";
import { app } from "../state/app.svelte";
import type { QuestData, QuestTask } from "./types";

const debut: QuestTask = {
  id: "t1",
  name: "Debut",
  trader: { id: "prapor", name: "Prapor" },
  minPlayerLevel: 1,
  objectives: [
    { id: "o1", type: "shoot", description: "Eliminate Scavs", maps: [{ id: "m1" }], count: 5 },
    { id: "o2", type: "giveItem", description: "Hand over the items", maps: [{ id: "m2" }], count: 2, foundInRaid: true, optional: true },
  ],
  experience: 1700,
  rewards: { items: [{ name: "Roubles", count: 15000 }], standing: [{ trader: "Prapor", delta: 0.02 }] },
  traderLevels: [{ trader: "Prapor", level: 1 }],
  failsOn: ["Shortage"],
};
const bearOnly: QuestTask = { id: "t2", name: "Our Own Land", trader: { id: "prapor", name: "Prapor" }, minPlayerLevel: 1, objectives: [], faction: "BEAR", requires: ["t1"] };
const usecOnly: QuestTask = { id: "t3", name: "Counteraction", trader: { id: "prapor", name: "Prapor" }, minPlayerLevel: 1, objectives: [], faction: "USEC" };

const data: QuestData = {
  schemaVersion: 0,
  fetchedAt: 0,
  tasks: [debut, bearOnly, usecOnly],
  maps: [
    { id: "m1", name: "Customs", normalizedName: "customs", extracts: [] },
    { id: "m2", name: "Woods", normalizedName: "woods", extracts: [] },
  ],
};

function open(faction: "any" | "usec" | "bear" = "any") {
  const target = document.body.appendChild(document.createElement("div"));
  const panel = mount(QuestPanel, {
    target,
    props: {
      markers: [],
      gameMode: "regular",
      playerLevel: 0,
      onPlayerLevel: () => {},
      availableOnly: false,
      onAvailableOnly: () => {},
      todoQuests: {},
      onTodoChange: () => {},
      shareTodo: false,
      onShareTodo: () => {},
      faction,
    },
  });
  return { target, panel };
}

const text = (el: Element) => el.textContent!.replace(/\s+/g, " ").trim();
const names = (target: HTMLElement) => [...target.querySelectorAll<HTMLButtonElement>(".list button.name")].map(text);
const nameButton = (target: HTMLElement, name: string) =>
  [...target.querySelectorAll<HTMLButtonElement>(".list button.name")].find((b) => text(b).startsWith(name))!;

describe("QuestPanel", () => {
  beforeEach(() => {
    app.setQuestData(data, "network");
    app.setDone({});
  });
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("hides the other faction's quests once a faction is picked, and badges them", () => {
    const any = open();
    // Same level and no markers on a map: alphabetical.
    expect(names(any.target)).toEqual(["Counteraction USEC", "Debut", "Our Own Land BEAR"]);
    void unmount(any.panel);
    document.body.innerHTML = "";
    const bear = open("bear");
    expect(names(bear.target)).toEqual(["Debut", "Our Own Land BEAR"]);
    void unmount(bear.panel);
  });

  it("unfolds a quest's objectives, gates, rewards and fail conditions on its name", () => {
    const { target, panel } = open();
    expect(target.querySelector(".detail")).toBeNull();
    const name = nameButton(target, "Debut");
    name.click();
    flushSync();
    const detail = target.querySelector(".detail")!;
    const objectives = [...detail.querySelectorAll(".objs li")].map(text);
    // The task spans two maps, so each line says where.
    expect(objectives).toEqual(["Eliminate Scavs ×5 · Customs", "Hand over the items ×2 (found in raid) (optional) · Woods"]);
    const lines = [...detail.querySelectorAll(".line")].map(text);
    expect(lines).toEqual(["Needs: Prapor LL1", "Rewards: +1,700 XP · Roubles ×15,000 · Prapor +0.02", "Fails on: Shortage"]);
    name.click();
    flushSync();
    expect(target.querySelector(".detail")).toBeNull();
    void unmount(panel);
  });

  it("names the prerequisite still to do", () => {
    const { target, panel } = open();
    nameButton(target, "Our Own Land").click();
    flushSync();
    expect(text(target.querySelector(".detail .line")!)).toBe("Needs: after Debut · BEAR only");
    void unmount(panel);
  });
});

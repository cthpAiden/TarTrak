import { describe, it, expect } from "vitest";
import { isOn, groupState, setGroup, setCategory, FILTER_KEY_RE, type Filters } from "./filters";

describe("isOn", () => {
  it("falls back to the defaults when no key is set", () => {
    expect(isOn({}, "extracts", "pmc")).toBe(true);
    expect(isOn({}, "loot", "safe")).toBe(false);
    expect(isOn({}, "extracts", "scav")).toBe(false);
  });

  it("prefers the category key over the group key", () => {
    expect(isOn({ loot: true, "loot/safe": false }, "loot", "safe")).toBe(false);
  });

  it("prefers the group key over the defaults", () => {
    expect(isOn({ extracts: false }, "extracts", "pmc")).toBe(false);
  });
});

describe("groupState", () => {
  const cats = ["pmc", "scav", "shared", "transit"];
  it("reports mixed, all and none", () => {
    expect(groupState({}, "extracts", cats)).toBe("some");
    expect(groupState({ extracts: true }, "extracts", cats)).toBe("all");
    expect(groupState({ extracts: false }, "extracts", cats)).toBe("none");
  });

  it("is none for an empty category list on a group that resolves off", () => {
    expect(groupState({}, "loot", [])).toBe("none");
  });
});

describe("setGroup", () => {
  it("writes the group key, drops category keys and does not mutate", () => {
    const before: Filters = { "loot/safe": true, "spawns/pmc": true };
    const after = setGroup(before, "loot", false);
    expect(after).toEqual({ loot: false, "spawns/pmc": true });
    expect(before).toEqual({ "loot/safe": true, "spawns/pmc": true });
  });
});

describe("setCategory", () => {
  it("writes only the category key", () => {
    expect(setCategory({}, "loot", "safe", true)).toEqual({ "loot/safe": true });
  });
});

describe("FILTER_KEY_RE", () => {
  it("accepts group and group/category keys", () => {
    for (const k of ["loot", "loot/safe", "Loot/weapon_box-2"]) {
      expect(FILTER_KEY_RE.test(k)).toBe(true);
    }
  });

  it("rejects malformed keys", () => {
    for (const k of ["loot/", "/safe", "a/b/c", "loot safe"]) {
      expect(FILTER_KEY_RE.test(k)).toBe(false);
    }
  });
});

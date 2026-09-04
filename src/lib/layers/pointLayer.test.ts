import { describe, it, expect } from "vitest";
import { iconFile, iconUrl, pointIcon, pointPopupHtml } from "./pointLayer";
import type { MapPoint } from "./points";

const pt = (over: Partial<MapPoint> = {}): MapPoint => ({
  id: "p1",
  group: "extracts",
  category: "pmc",
  name: "ZB-1011",
  mapKey: "customs",
  x: 0,
  y: 0,
  z: 0,
  details: [],
  ...over,
});

describe("iconFile", () => {
  it("names extract and spawn icons by category", () => {
    expect(iconFile({ group: "extracts", category: "transit" })).toBe("extract_transit");
    expect(iconFile({ group: "spawns", category: "pmc" })).toBe("spawn_pmc");
    expect(iconFile({ group: "spawns", category: "sniper" })).toBe("spawn_sniper_scav");
    expect(iconFile({ group: "spawns", category: "cultist-priest" })).toBe("spawn_cultist-priest");
    expect(iconFile({ group: "spawns", category: "unknown-boss" })).toBe("spawn_boss");
  });

  it("maps containers like tarkov.dev, aliasing the ones without a picture", () => {
    expect(iconFile({ group: "loot", category: "safe" })).toBe("container_safe");
    expect(iconFile({ group: "loot", category: "bank-safe" })).toBe("container_safe");
    expect(iconFile({ group: "loot", category: "pmc-body" })).toBe("container_dead-scav");
    expect(iconFile({ group: "loot", category: "ration-supply-crate" })).toBe("container_crate");
    expect(iconFile({ group: "loot", category: "shturmans-stash" })).toBe("container_weapon-box");
    expect(iconFile({ group: "loot", category: "never-seen" })).toBe("container_crate");
  });

  it("uses one icon per remaining group", () => {
    expect(iconFile({ group: "lootLoose", category: "item" })).toBe("loose_loot");
    expect(iconFile({ group: "locks", category: "door" })).toBe("lock");
    expect(iconFile({ group: "hazards", category: "minefield" })).toBe("hazard");
    expect(iconFile({ group: "switches", category: "switch" })).toBe("switch");
    expect(iconFile({ group: "guns", category: "gun" })).toBe("stationarygun");
    expect(iconFile({ group: "btr", category: "stop" })).toBe("btr_stop");
  });

  it("builds the public URL", () => {
    expect(iconUrl({ group: "loot", category: "drawer" })).toBe("/icons/container_drawer.png");
  });
});

describe("pointIcon", () => {
  it("is a 24px image centred on the point with the group and category as classes", () => {
    const icon = pointIcon(pt({ group: "locks", category: "door" }));
    expect(icon.options.iconUrl).toBe("/icons/lock.png");
    expect(icon.options.iconSize).toEqual([24, 24]);
    expect(icon.options.iconAnchor).toEqual([12, 12]);
    expect(icon.options.className).toBe("point-icon locks door");
  });

  it("hangs PMC spawn arrows from their bottom edge", () => {
    const icon = pointIcon(pt({ group: "spawns", category: "pmc" }));
    expect(icon.options.iconAnchor).toEqual([12, 24]);
    expect(icon.options.popupAnchor).toEqual([0, -24]);
  });
});

describe("pointPopupHtml", () => {
  it("lists the details above the elevation line", () => {
    const html = pointPopupHtml(pt({ name: "ZB-1011", details: ["PMC extract"], y: 12.345 }));
    expect(html).toBe("<b>ZB-1011</b><br><small>PMC extract<br>Elevation 12.3</small>");
  });

  it("still shows the elevation when there are no details", () => {
    expect(pointPopupHtml(pt({ name: "Safe", y: -4 }))).toBe("<b>Safe</b><br><small>Elevation -4.0</small>");
  });

  it("joins every detail line", () => {
    const html = pointPopupHtml(pt({ details: ["Bolts", "Screws", "Nuts"] }));
    expect(html).toContain("Bolts<br>Screws<br>Nuts<br>Elevation 0.0");
  });

  it("escapes the name and the details", () => {
    const html = pointPopupHtml(pt({ name: "<b>x</b>", details: [`<img src=x onerror=alert(1)>`] }));
    expect(html).not.toContain("<img");
    expect(html).toContain("&#60;b&#62;x&#60;/b&#62;");
  });
});

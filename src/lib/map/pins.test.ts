import { describe, it, expect, vi } from "vitest";
import { newPinId, pinIcon, pinPopup } from "./pins";
import type { Pin } from "../state/app.svelte";

const pin: Pin = { id: "abcd1234", map: "customs", x: 1, z: 2, label: "<b>loot</b>", color: "#12ab34", shared: false };

describe("newPinId", () => {
  it("is 8 lowercase alphanumerics and follows the injected RNG", () => {
    expect(newPinId()).toMatch(/^[a-z0-9]{8}$/);
    expect(newPinId(() => 0)).toBe("aaaaaaaa");
    expect(newPinId(() => 0.999999)).toBe("99999999");
  });
});

describe("pinIcon", () => {
  it("fills the pin with its colour and marks shared pins", () => {
    const html = String(pinIcon(pin).options.html);
    expect(html).toContain('fill="#12ab34"');
    expect(pinIcon(pin).options.className).toBe("pin-icon");
    expect(pinIcon({ ...pin, shared: true }).options.className).toBe("pin-icon shared");
  });
});

describe("pinPopup", () => {
  it("shows the label as text, not markup, and says who sees the pin", () => {
    const el = pinPopup(pin, null, () => {});
    expect(el.querySelector("b")!.textContent).toBe("<b>loot</b>");
    expect(el.querySelector("b b")).toBeNull();
    expect(el.textContent).toContain("Only you can see this");
    expect(pinPopup({ ...pin, shared: true }, "Ann", () => {}).textContent).toContain("Shared · placed by Ann");
    expect(pinPopup({ ...pin, shared: true }, null, () => {}).textContent).toContain("Shared with the squad");
    expect(pinPopup({ ...pin, label: "" }, null, () => {}).querySelector("b")!.textContent).toBe("Marker");
  });

  it("calls back when Remove is clicked", () => {
    const onRemove = vi.fn();
    const el = pinPopup(pin, null, onRemove);
    el.querySelector("button")!.click();
    expect(onRemove).toHaveBeenCalledOnce();
  });
});

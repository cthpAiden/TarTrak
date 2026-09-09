import { describe, it, expect } from "vitest";
import { DEFAULT_MARK_KEY_VK, markKeyFromButton, markKeyFromCode, markKeyLabel } from "./markKey";

describe("mark key table", () => {
  it("knows modifiers on their own, function keys, letters and digits", () => {
    expect(markKeyFromCode("AltLeft")).toEqual({ vk: 0xa4, label: "Left Alt" });
    expect(markKeyFromCode("F7")).toEqual({ vk: 0x76, label: "F7" });
    expect(markKeyFromCode("KeyM")).toEqual({ vk: 0x4d, label: "M" });
    expect(markKeyFromCode("Digit3")).toEqual({ vk: 0x33, label: "3" });
    expect(markKeyFromCode("Numpad5")).toEqual({ vk: 0x65, label: "Numpad 5" });
  });

  it("refuses PrintScreen and unknown codes", () => {
    expect(markKeyFromCode("PrintScreen")).toBeNull();
    expect(markKeyFromCode("Escape")).toBeNull();
    expect(markKeyFromCode("Backspace")).toBeNull();
    expect(markKeyFromCode("")).toBeNull();
  });

  it("maps the middle and side mouse buttons only", () => {
    expect(markKeyFromButton(3)).toEqual({ vk: 0x05, label: "Mouse 4" });
    expect(markKeyFromButton(4)).toEqual({ vk: 0x06, label: "Mouse 5" });
    expect(markKeyFromButton(1)?.label).toBe("Middle Mouse");
    expect(markKeyFromButton(0)).toBeNull();
    expect(markKeyFromButton(2)).toBeNull();
  });

  it("labels a stored code, Off for zero, hex for a code it does not know", () => {
    expect(markKeyLabel(DEFAULT_MARK_KEY_VK)).toBe("Left Alt");
    expect(markKeyLabel(0)).toBe("Off");
    expect(markKeyLabel(0x05)).toBe("Mouse 4");
    expect(markKeyLabel(0xff)).toBe("Key 0xFF");
  });
});

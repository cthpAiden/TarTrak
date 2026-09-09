import { describe, it, expect } from "vitest";
import { DEFAULT_MARK_KEY_VK, DEFAULT_SHOT_KEY_VK, markKeyFromButton, markKeyFromCode, markKeyLabel, shotKeyFromBinding, unityKeyToVk } from "./markKey";

describe("mark key table", () => {
  it("knows modifiers on their own, function keys, letters and digits", () => {
    expect(markKeyFromCode("AltLeft")).toEqual({ vk: 0xa4, label: "Left Alt" });
    expect(markKeyFromCode("F7")).toEqual({ vk: 0x76, label: "F7" });
    expect(markKeyFromCode("KeyM")).toEqual({ vk: 0x4d, label: "M" });
    expect(markKeyFromCode("Digit3")).toEqual({ vk: 0x33, label: "3" });
    expect(markKeyFromCode("Numpad5")).toEqual({ vk: 0x65, label: "Numpad 5" });
  });

  it("knows PrintScreen, refuses unknown codes", () => {
    expect(markKeyFromCode("PrintScreen")).toEqual({ vk: DEFAULT_SHOT_KEY_VK, label: "PrintScreen" });
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

  it("maps the game's Unity key names to virtual-key codes", () => {
    expect(unityKeyToVk("V")).toBe(0x56);
    expect(unityKeyToVk("Print")).toBe(0x2c);
    expect(unityKeyToVk("Alpha7")).toBe(0x37);
    expect(unityKeyToVk("Keypad3")).toBe(0x63);
    expect(unityKeyToVk("F12")).toBe(0x7b);
    expect(unityKeyToVk("Mouse4")).toBe(0x06);
    expect(unityKeyToVk("LeftControl")).toBe(0xa2);
    expect(unityKeyToVk("Joystick1Button3")).toBeNull();
    expect(unityKeyToVk("")).toBeNull();
  });

  it("picks the non-modifier key of a logged screenshot binding, null when empty or unknown", () => {
    expect(shotKeyFromBinding(["V"])).toBe(0x56);
    expect(shotKeyFromBinding(["LeftControl", "F12"])).toBe(0x7b);
    expect(shotKeyFromBinding(["Print"])).toBe(0x2c);
    expect(shotKeyFromBinding([])).toBeNull();
    expect(shotKeyFromBinding(["LeftAlt"])).toBeNull();
    expect(shotKeyFromBinding(["Joystick1Button3"])).toBeNull();
  });

  it("labels a stored code, Off for zero, hex for a code it does not know", () => {
    expect(markKeyLabel(DEFAULT_MARK_KEY_VK)).toBe("Left Alt");
    expect(markKeyLabel(0)).toBe("Off");
    expect(markKeyLabel(0x05)).toBe("Mouse 4");
    expect(markKeyLabel(DEFAULT_SHOT_KEY_VK)).toBe("PrintScreen");
    expect(markKeyLabel(0xff)).toBe("Key 0xFF");
  });
});

/**
 * The mark-here key is stored as a Windows virtual-key code, which is what the Rust poller reads.
 * This table maps a browser `KeyboardEvent.code` (or a mouse button) to that code and its name.
 */
export interface MarkKey {
  vk: number;
  label: string;
}

/** Left Alt: the game still takes a screenshot with it held, unlike Ctrl. */
export const DEFAULT_MARK_KEY_VK = 0xa4;
export const MARK_KEY_OFF = 0;

const BY_CODE: Record<string, MarkKey> = {
  AltLeft: { vk: 0xa4, label: "Left Alt" },
  AltRight: { vk: 0xa5, label: "Right Alt" },
  ControlLeft: { vk: 0xa2, label: "Left Ctrl" },
  ControlRight: { vk: 0xa3, label: "Right Ctrl" },
  ShiftLeft: { vk: 0xa0, label: "Left Shift" },
  ShiftRight: { vk: 0xa1, label: "Right Shift" },
  Space: { vk: 0x20, label: "Space" },
  Tab: { vk: 0x09, label: "Tab" },
  CapsLock: { vk: 0x14, label: "Caps Lock" },
  Enter: { vk: 0x0d, label: "Enter" },
  Backquote: { vk: 0xc0, label: "`" },
  Minus: { vk: 0xbd, label: "-" },
  Equal: { vk: 0xbb, label: "=" },
  BracketLeft: { vk: 0xdb, label: "[" },
  BracketRight: { vk: 0xdd, label: "]" },
  Backslash: { vk: 0xdc, label: "\\" },
  Semicolon: { vk: 0xba, label: ";" },
  Quote: { vk: 0xde, label: "'" },
  Comma: { vk: 0xbc, label: "," },
  Period: { vk: 0xbe, label: "." },
  Slash: { vk: 0xbf, label: "/" },
  Insert: { vk: 0x2d, label: "Insert" },
  Home: { vk: 0x24, label: "Home" },
  PageUp: { vk: 0x21, label: "Page Up" },
  End: { vk: 0x23, label: "End" },
  PageDown: { vk: 0x22, label: "Page Down" },
  ArrowLeft: { vk: 0x25, label: "Left Arrow" },
  ArrowUp: { vk: 0x26, label: "Up Arrow" },
  ArrowRight: { vk: 0x27, label: "Right Arrow" },
  ArrowDown: { vk: 0x28, label: "Down Arrow" },
  ScrollLock: { vk: 0x91, label: "Scroll Lock" },
  Pause: { vk: 0x13, label: "Pause" },
  NumLock: { vk: 0x90, label: "Num Lock" },
  NumpadMultiply: { vk: 0x6a, label: "Numpad *" },
  NumpadAdd: { vk: 0x6b, label: "Numpad +" },
  NumpadSubtract: { vk: 0x6d, label: "Numpad -" },
  NumpadDecimal: { vk: 0x6e, label: "Numpad ." },
  NumpadDivide: { vk: 0x6f, label: "Numpad /" },
  NumpadEnter: { vk: 0x0d, label: "Enter" },
};
for (let i = 1; i <= 24; i++) BY_CODE[`F${i}`] = { vk: 0x70 + i - 1, label: `F${i}` };
for (let i = 0; i < 26; i++) {
  const c = String.fromCharCode(65 + i);
  BY_CODE[`Key${c}`] = { vk: 0x41 + i, label: c };
}
for (let i = 0; i <= 9; i++) {
  BY_CODE[`Digit${i}`] = { vk: 0x30 + i, label: String(i) };
  BY_CODE[`Numpad${i}`] = { vk: 0x60 + i, label: `Numpad ${i}` };
}

/** `MouseEvent.button` for the buttons worth binding: middle and the two side buttons. */
const BY_BUTTON: Record<number, MarkKey> = {
  1: { vk: 0x04, label: "Middle Mouse" },
  3: { vk: 0x05, label: "Mouse 4" },
  4: { vk: 0x06, label: "Mouse 5" },
};

const BY_VK = new Map<number, string>();
for (const k of [...Object.values(BY_CODE), ...Object.values(BY_BUTTON)]) {
  if (!BY_VK.has(k.vk)) BY_VK.set(k.vk, k.label);
}

/** The key a capture should record, or null for one the table does not know (PrintScreen included). */
export function markKeyFromCode(code: string): MarkKey | null {
  return BY_CODE[code] ?? null;
}

export function markKeyFromButton(button: number): MarkKey | null {
  return BY_BUTTON[button] ?? null;
}

export function markKeyLabel(vk: number): string {
  if (vk === MARK_KEY_OFF) return "Off";
  return BY_VK.get(vk) ?? `Key 0x${vk.toString(16).toUpperCase()}`;
}

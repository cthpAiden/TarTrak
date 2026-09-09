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
/** PrintScreen: the game's stock screenshot key. */
export const DEFAULT_SHOT_KEY_VK = 0x2c;
export const PRINT_SCREEN_VK = DEFAULT_SHOT_KEY_VK;

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
  PrintScreen: { vk: 0x2c, label: "PrintScreen" },
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

/** The key a capture should record, or null for one the table does not know. */
export function markKeyFromCode(code: string): MarkKey | null {
  return BY_CODE[code] ?? null;
}

export function markKeyFromButton(button: number): MarkKey | null {
  return BY_BUTTON[button] ?? null;
}

/** Unity KeyCode names the game logs its bindings with, for the keys the code table above does not cover. */
const UNITY_SPECIAL: Record<string, number> = {
  Print: 0x2c,
  Space: 0x20,
  Tab: 0x09,
  CapsLock: 0x14,
  Return: 0x0d,
  KeypadEnter: 0x0d,
  Backspace: 0x08,
  Escape: 0x1b,
  Insert: 0x2d,
  Home: 0x24,
  End: 0x23,
  PageUp: 0x21,
  PageDown: 0x22,
  Delete: 0x2e,
  UpArrow: 0x26,
  DownArrow: 0x28,
  LeftArrow: 0x25,
  RightArrow: 0x27,
  ScrollLock: 0x91,
  Numlock: 0x90,
  Pause: 0x13,
  LeftAlt: 0xa4,
  RightAlt: 0xa5,
  LeftControl: 0xa2,
  RightControl: 0xa3,
  LeftShift: 0xa0,
  RightShift: 0xa1,
  BackQuote: 0xc0,
  Minus: 0xbd,
  Equals: 0xbb,
  LeftBracket: 0xdb,
  RightBracket: 0xdd,
  Backslash: 0xdc,
  Semicolon: 0xba,
  Quote: 0xde,
  Comma: 0xbc,
  Period: 0xbe,
  Slash: 0xbf,
  KeypadPeriod: 0x6e,
  KeypadDivide: 0x6f,
  KeypadMultiply: 0x6a,
  KeypadMinus: 0x6d,
  KeypadPlus: 0x6b,
  Mouse0: 0x01,
  Mouse1: 0x02,
  Mouse2: 0x04,
  Mouse3: 0x05,
  Mouse4: 0x06,
};

/** Windows virtual-key code for a Unity KeyCode name, or null for one the table does not know. */
export function unityKeyToVk(name: string): number | null {
  if (name in UNITY_SPECIAL) return UNITY_SPECIAL[name];
  let m = /^([A-Z])$/.exec(name);
  if (m) return 0x41 + m[1].charCodeAt(0) - 65;
  m = /^Alpha([0-9])$/.exec(name);
  if (m) return 0x30 + Number(m[1]);
  m = /^Keypad([0-9])$/.exec(name);
  if (m) return 0x60 + Number(m[1]);
  m = /^F([1-9]|1[0-9]|2[0-4])$/.exec(name);
  if (m) return 0x70 + Number(m[1]) - 1;
  return null;
}

const MODIFIER_VKS = new Set([0xa0, 0xa1, 0xa2, 0xa3, 0xa4, 0xa5, 0x10, 0x11, 0x12]);

/**
 * The key to watch for a screenshot binding the game logged: the first key in it that is not a
 * modifier (so a binding like Ctrl+F12 watches F12), or null when the list is empty or unknown.
 */
export function shotKeyFromBinding(keys: string[]): number | null {
  const vks = keys.map(unityKeyToVk);
  if (vks.some((v) => v === null)) return null;
  return (vks as number[]).find((v) => !MODIFIER_VKS.has(v)) ?? null;
}

export function markKeyLabel(vk: number): string {
  if (vk === MARK_KEY_OFF) return "Off";
  return BY_VK.get(vk) ?? `Key 0x${vk.toString(16).toUpperCase()}`;
}

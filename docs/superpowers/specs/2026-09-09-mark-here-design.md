# Mark here: one press drops a marker at your position (0.8.0)

Date: 2026-09-09. Approved by the user in chat.

## Problem

Dropping a marker takes a right-click on the map and a menu pick. In a fight (drop the backpack, come
back for it later) there is no time for that. The user wants one key press that marks where they stand.

## Constraints

- Ban-safe as the README promises: no keyboard hook, no input sent to the game, nothing touches the
  game process. The game must still take the screenshot itself.
- The game ignores its screenshot key while Ctrl is held; Alt works. Double-tapping the screenshot
  key was rejected. Mouse side buttons are fine to bind but not as the default.
- The key must be rebindable from the Settings tab.

## Design

**Mark key.** New setting `markKeyVk: number`, a Windows virtual-key code, default `0xA4` (Left Alt),
`0` = off. Settings gets a row "Mark-here key" with a button showing the key's name. Clicking it
puts the button into capture ("Press a key…"): the next key or mouse button pressed becomes the mark
key, Escape, a second click on the button or a left or right click elsewhere cancels, Backspace or
Delete turns it off. Modifiers on their own (Alt, Ctrl, Shift, left
or right), function keys, letters, digits, punctuation, navigation keys, numpad and mouse buttons 3-5
are accepted. PrintScreen is refused (it would mark every screenshot); keys the table does not know
are refused with a toast. The name table lives in `src/lib/settings/markKey.ts` (browser `code` ->
VK code + label) and is the only place that knows about VK codes on the TS side.

**Poller (Rust, `src-tauri/src/markkey.rs`).** Command `start_mark_key(vk)` replaces any running
poller: a thread reads `GetAsyncKeyState(vk)` every 10 ms and emits the Tauri event `markkey` on each
down-edge (high bit goes from clear to set). `vk == 0` only stops; there is no separate stop command. The thread
ends when a generation counter moves on, so a restart never leaves two pollers. Windows only; on
other targets the command is a no-op. No hook, no injected input: the same call push-to-talk apps
make. Read as a single sentence into the README's ban-safety section.

**Chord (0.8.2, key source changed in 0.8.3).** The 2 s either-order pairing marked on a bare Alt
(Alt+Tab, Alt+drag) or a bare screenshot after one, which the user rejected. The game's screenshot
key comes from its log: at start the game dumps its control settings as one JSON line holding
`"keyName":"MakeScreenshot","variants":[{"keyCode":["V"]},...]` (Unity KeyCode names);
`parseLogLine` yields `screenshotKey`, `shotKeyFromBinding` maps it to a VK (first non-modifier key),
`AppState.shotKeyVk` holds it (null until the log says, PrintScreen assumed) and Settings shows it
read-only. The 0.8.2 `shotKeyVk` setting was dropped: left at PrintScreen it silenced the chord. the Rust poller reads both keys and emits `markkey`
only on the screenshot key's down-edge while the mark key is down (`Chord::tick`), and `MarkPairer`
marks only the next screenshot within 2 s after a chord, never a screenshot before it.

**Elevation (0.8.1).** The game runs elevated (the BSG launcher requests administrator rights) and
UIPI makes `GetAsyncKeyState` return 0 to a lower-integrity process while an elevated window is in
front; low-level hooks and Raw Input are blocked the same way, only a UIAccess signature (trusted CA
certificate, Program Files install) gets through. So the app's Windows manifest
(`src-tauri/windows-app-manifest.xml`, wired in `build.rs`) requests `requireAdministrator`: a UAC
prompt at every start, the same one the launcher shows.

**Pairing (TS, `src/lib/tauri/markHere.ts`).** `MarkPairer` remembers the last unused key press and
the last unused screenshot position. A screenshot arriving within 2 s after a press, or a press
within 2 s after a screenshot, marks that screenshot's position. Each press marks at most one
screenshot and each screenshot is marked at most once. Order is free, so `Alt` held while tapping
PrintScreen is one motion, and `F7` then PrintScreen (or the reverse) also works. Pure TS with unit
tests.

**Wiring.** `startEventBridge` gains an `onPosition` and an `onMarkKey` callback; the `screenshot`
event feeds both the map and the pairer, the `markkey` event feeds the pairer. `App.svelte` starts
the poller after settings load and again when `markKeyVk` changes. On a mark, `placePin` drops a
private pin at the position labelled `Marked HH:MM` (local time of day) and a toast says "Marked".
No pin when no map is known. No toast on a press without a screenshot: with Alt as the default,
Alt+Tab and Alt+drag would nag.

**Known edge.** Alt+drag (moving the overlay) followed by a screenshot within 2 s marks that
screenshot. Told in the Settings tooltip.

## Files

- `src-tauri/src/markkey.rs` (new), `lib.rs` (register command and state), `Cargo.toml`
  (`windows-sys` with `Win32_UI_Input_KeyboardAndMouse`).
- `src/lib/settings/markKey.ts` (+ test): key table, `keyFromEvent`, `markKeyLabel`.
- `src/lib/settings/store.ts`: `markKeyVk`; anything but an integer 0..255 resets to the default.
- `src/lib/settings/SettingsPanel.svelte` (+ test): capture button.
- `src/lib/tauri/markHere.ts` (+ test): `MarkPairer`.
- `src/lib/tauri/events.ts` (+ test), `commands.ts`, `App.svelte`.
- README, CHANGELOG, version bump to 0.8.0.

## Testing

- Unit: pairer windows and one-shot rules; key table lookups; settings clamp; Settings capture
  reports the VK, Escape cancels, Backspace clears, PrintScreen refused.
- By hand: `cargo test` and `npm test` green, `npm run check` clean; in a raid, hold Alt and tap
  PrintScreen once: the dot moves and a pin appears with a toast.

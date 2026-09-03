# TarTrak v1 — design spec

Date: 2026-09-04. Status: approved decisions from HANDOFF.md, awaiting user review of this document.

## 1. Purpose

Free, open-source Windows desktop app for Escape from Tarkov. Shows an interactive map with your own
position and heading, your teammates' positions and headings via a shared room code, and quest markers.
Feature-set clone of TarkovQuestie (proprietary). No code, maps, or assets from TarkovQuestie are used.

## 2. Hard constraints

1. $0 to use, $0 to host. Cloudflare Workers free tier for the relay, GitHub for releases.
2. Ban-safe. The only game interaction is reading PNG filenames from the screenshot folder and reading
   text log files. No memory reading, no injection, no hooks, no keystrokes sent to the game.
3. No accounts, login, licensing, or payments.
4. MIT license. Everything public.

## 3. Stack

| Layer | Choice |
|---|---|
| Shell | Tauri 2 (Rust, WebView2) |
| Frontend | Svelte 5 + TypeScript + Leaflet |
| Relay | Cloudflare Worker + Durable Objects (TypeScript), WebSocket Hibernation API |
| Tests | vitest (TS), cargo test (Rust) |
| CI/CD | GitHub Actions: build, sign updater artifacts, publish GitHub Release |

Rust side is deliberately small. Anything that can live in TypeScript does.

## 4. Repository layout

```
src/                 Svelte frontend
  lib/parse/         pure TS: screenshot filename parser, log line parser, quaternion->yaw
  lib/map/           Leaflet setup, coordinate transform, layers, markers
  lib/room/          WebSocket client, room state, fade logic
  lib/quests/        tarkov.dev data loading, marker extraction, done-state store
  lib/settings/      settings store (persisted via tauri-plugin-store)
src-tauri/           Rust: window commands, file watcher, log tail, hotkeys, updater
relay/               Cloudflare Worker (separate package.json, wrangler.toml)
data/snapshot/       bundled tarkov.dev `regular` snapshot for offline first run
docs/superpowers/    specs and plans
```

## 5. Components

### 5.1 Screenshot watcher (Rust)

- Watches the screenshot directory with the `notify` crate. Default:
  `%USERPROFILE%\Documents\Escape from Tarkov\Screenshots`. Overridable in settings.
- On new `.png`: emit Tauri event `screenshot` with the bare filename. Then, if the "delete
  screenshots" setting is on (default on), delete the file. Deletion is retried up to 5 times over
  1 s because the game may still hold the handle.
- Rust does no parsing. Filename parsing lives in TS so it is unit-testable with vitest.

### 5.2 Filename parser (TS, pure)

Input: filename string. Output: `{ x, y, z, yaw } | null`.

Regex (adapted from TarkovMonitor, GPL-3.0; regex re-derived, not copied as code):

```
^\d{4}-\d{2}-\d{2}\[\d{2}-\d{2}\]_?(-?\d+\.\d{2}), (-?\d+\.\d{2}), (-?\d+\.\d{2})_(-?\d\.\d{1,5}), (-?\d\.\d{1,5}), (-?\d\.\d{1,5}), (-?\d\.\d{1,5}) \(\d+\)\.png$
```

Heading: Unity quaternion `(rx, ry, rz, rw)`, y-up. Yaw in degrees =
`atan2(2*(rw*ry + rx*rz), 1 - 2*(ry*ry + rz*rz))` converted to degrees, normalized to `[0, 360)`.
Verified against real filenames in tests before anything else is built.

### 5.3 Log tail (Rust) + log parser (TS, pure)

- Rust finds the newest `log_*` folder under the logs dir (default `<EFT install>\Logs`, detected via
  the game's registry uninstall key when possible, else user sets it) and tails `*application_000.log`.
  Emits Tauri event `logline` per new line.
- TS parser recognizes:
  - `scene preset path:maps/<name>_preset.bundle` -> map about to load
  - `Location: <Name>,` inside `TRACE-NetworkGameCreate profileStatus` -> map name
  - `GameStarted` -> raid started. Raid-end detection: exact line pattern to be confirmed against a real log during task 1; if none is reliable, raid end is not detected in v1 and the marker simply goes stale.
- Map name maps to tarkov.dev map id via a fixed lookup table. Unknown name -> keep current map, show
  a toast. Manual map picker is always available as fallback.

### 5.4 Map view (Svelte + Leaflet)

- Leaflet with `CRS.Simple`. Map SVG layers from
  [tarkov-dev-svg-maps](https://github.com/the-hideout/tarkov-dev-svg-maps) (CC BY-NC-SA 4.0,
  attribution shown in About). Fetched at first use and cached in app data dir.
- Per-map transform from tarkov.dev `maps.json` (MIT): `transform [scaleX, offsetX, scaleY, offsetY]`,
  `coordinateRotation`, `bounds`, `layers` with height ranges. Game `(x, z)` -> map pixel via that
  transform. Height `y` selects the floor layer; user can pin a floor manually.
- Controls: wheel zoom, drag pan, floor toggle, right-click context menu (center on me, pick map,
  clear room, settings).
- Markers:
  - Own: filled circle + heading line (length fixed in screen pixels). Distinct color.
  - Teammates: same shape, their chosen color, name label.
  - Quest: small icons per objective type; click opens popup with quest name, trader, objective text.
  - Extracts: PMC extracts from `maps.json`, toggleable layer.

### 5.5 Marker persistence and fade

- Markers never disappear on their own. Last-known position and heading stay until the next update.
- Opacity: 1.0 until 30 s since last update. Then linear to 0.35 at 300 s. Clamp at 0.35 forever.
- Computed every 1 s by a single ticker in `lib/room/fade.ts` (pure function `opacityFor(ageMs)`).
- Teammates render only when their `map` equals the current map.

### 5.6 Rooms and relay

Client (TS):
- Join dialog: room code (6 chars, A-Z0-9, generated locally on "Create"), display name, color.
  Name and color persisted.
- One WebSocket to `wss://<relay>/room/<CODE>`. Default relay URL baked in; overridable in settings.
- On each parsed screenshot, send `{ name, map, x, y, z, yaw, ts }`. Throttle: max one send per 500 ms.
- Receive `{ id, name, color, map, x, y, z, yaw, ts }` for others. Also `{ type: "leave", id }`.
- Reconnect with exponential backoff (1 s .. 30 s). Room state survives reconnect.

Relay (Cloudflare Worker + Durable Object, one DO per room code):
- Accepts WebSocket upgrade on `/room/:code`. Uses Hibernation API so idle rooms cost nothing.
- Keeps an in-memory map `id -> last message`. On join, sends the newcomer everyone's last message.
- Broadcasts each incoming message to all other sockets in the room. Validates shape and size
  (< 512 bytes) and drops anything else.
- No persistence, no auth, no logging of positions. Room evaporates when the last socket closes.

### 5.7 Quests

- Data: tarkov.dev GraphQL `POST https://api.tarkov.dev/graphql`, `regular` mode only. Query tasks
  (with objectives, zones, item positions, trader, min level) and maps.
- Cache: response stored in app data dir with timestamp. Refresh in background if older than 24 h.
  If API fails, use cache; if no cache, use bundled `data/snapshot/`. Never block UI on network.
- Side panel: quest list grouped by trader, filter by player level (setting) and done state,
  search box. Checkbox marks done; done quests' markers hide. Done set persisted as JSON.

### 5.8 Overlay window and hotkeys (Rust + TS)

- Single window. Two modes:
  - Normal: decorated, resizable, taskbar entry.
  - Overlay (F5): undecorated, always-on-top, transparent background, no taskbar entry.
    Alt+drag moves the window (handled in TS via `startDragging`).
- F6 cycles window opacity 100 -> 70 -> 40 -> 100 %.
- Hotkeys registered with `tauri-plugin-global-shortcut` so they work while the game has focus.
  Rebindable in settings. Conflicts with game binds are the user's problem; defaults match original.
- Overlay only works when the game runs in borderless windowed mode. Stated in README.

### 5.9 Settings (TS, tauri-plugin-store)

screenshot dir, logs dir, delete screenshots (bool), relay URL, display name, color, player level,
hotkeys, last map, window size/position/mode, marker line length.

### 5.10 Updater

`tauri-plugin-updater` pointed at `latest.json` in GitHub Releases. Updater public key in
`tauri.conf.json`. Private key in GitHub Actions secret `TAURI_SIGNING_PRIVATE_KEY`. Never committed.
Check on startup, prompt to install.

## 6. Data flow

```
game writes PNG ──> notify (Rust) ──event──> parseFilename (TS) ──> own marker
                                                    └──throttle──> WebSocket ──> DO ──> teammates
game writes log ──> tail (Rust) ──event──> parseLogLine (TS) ──> current map
tarkov.dev API ──> cache ──> quest markers, extracts
```

## 7. Error handling

- Unparseable filename: ignore, debug log only. Never crash, never toast (user spams PrintScreen).
- Screenshot dir missing: banner in UI with "pick folder" button. Watcher retries every 10 s.
- Log dir missing: map auto-detect disabled, banner offers manual pick and folder setting.
- Relay unreachable: status dot turns red, own marker still works, reconnect loop runs.
- tarkov.dev down: use cache or snapshot, show "data from <date>" in panel footer.
- SVG map fetch fails: show map name and markers on blank grid, retry button.

## 8. Testing

- `lib/parse/*`: vitest with real filename fixtures and real log excerpts. Written first (TDD).
- `lib/room/fade.ts`, coordinate transform: vitest, table-driven.
- Relay: vitest with `wrangler` miniflare — two clients join, one sends, other receives, join
  replays last state.
- Rust: cargo tests for filename event emission and retry-delete using a temp dir.
- Manual: overlay over borderless EFT, hotkeys while game focused, two PCs in one room.

## 9. Out of scope for v1

LAN mode, pve / pvp-season data, quest tree graph, auto quest progress from notifications log,
hideout, stats, mini tracker, keys / loot markers, view cone, any enemy information.

## 10. Build order

1. `lib/parse` filename + log parsers, TDD.
2. Tauri scaffold, screenshot watcher, event to TS, own marker on a blank canvas.
3. Leaflet map with SVG layers, transforms, floors. Own marker on real map.
4. Relay Worker + client, two-client test, fade.
5. tarkov.dev fetch + cache + snapshot, quest markers, extracts, done panel.
6. Overlay mode, hotkeys, settings, updater, CI release.

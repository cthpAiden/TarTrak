# TarTrak v1 — design spec

Date: 2026-09-04. Status: reviewed and approved; implementation plan follows.

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

Filename shape (re-derived from public descriptions, not copied from any codebase):

```
YYYY-MM-DD[HH-MM]_X, Y, Z_RX, RY, RZ, RW[_EXTRA] (N).png
2024-05-04[22-01]_-114.6, 1.1, -98.2_0.0, 0.9, 0.0, -0.4_14.83 (0).png
```

Regex is lenient on purpose: every number is `-?\d+(?:\.\d+)?`, the time block may also carry
seconds (`[HH-MM-SS]`), the `_EXTRA` float after the quaternion is optional, the ` (N)` counter is
optional, and matching is case-insensitive on `.png`. Numbers are parsed with `Number()`.
Anything that does not match returns `null`.

Heading: Unity quaternion `(rx, ry, rz, rw)`, y-up. Rotate the forward vector `(0, 0, 1)` by the
quaternion: `fx = 2*(rx*rz + rw*ry)`, `fz = 1 - 2*(rx*rx + ry*ry)`. Yaw in degrees =
`atan2(fx, fz)` converted to degrees, normalized to `[0, 360)`. For a pure y-rotation this reduces
to the rotation angle; for pitched/rolled cameras it still gives the compass heading.
Tests use the example above plus synthetic pure-y quaternions (0, 90, 180, 270 degrees).
Which map direction yaw 0 points to on screen is settled in the map layer with `coordinateRotation`.

### 5.3 Log tail (Rust) + log parser (TS, pure)

- Rust finds the newest `log_*` folder under the logs dir (default `<EFT install>\Logs`, detected via
  the game's registry uninstall key when possible, else user sets it) and tails the newest `*application*.log` in it (exact name to be confirmed on a real install; glob
  keeps it working either way). Emits Tauri event `logline` per new line.
- TS parser recognizes:
  - `scene preset path:maps/<name>_preset.bundle` -> map about to load
  - `Location: <Name>,` inside `TRACE-NetworkGameCreate profileStatus` -> map name
  - `GameStarted` -> raid started. Raid-end detection: exact line pattern to be confirmed against a real log during task 1; if none is reliable, raid end is not detected in v1 and the marker simply goes stale.
- Map name maps to tarkov.dev map id via a fixed lookup table. Unknown name -> keep current map, show
  a toast. Manual map picker is always available as fallback.

### 5.4 Map view (Svelte + Leaflet)

- Leaflet with a rotated `CRS.Simple` (same math as tarkov.dev, MIT). SVG fetched as text, wrapped in
  an inline `<svg>` and shown with `L.svgOverlay`; top-level `<g id>` groups are floors, toggled by
  CSS class. Maps without an SVG in maps.json (Labs, Labyrinth) show a blank grid in v1. SVGs from
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
- On open, send `{ type: "hello", name, color }`. On each parsed screenshot, send
  `{ type: "pos", name, color, map, x, y, z, yaw, ts }`. Throttle: max one send per 500 ms.
- Receive `{ type: "pos", id, name, color, map, x, y, z, yaw, ts }` for others,
  `{ type: "hello", id, name, color }` when someone joins, and `{ type: "leave", id }`.
  `id` is assigned by the relay per socket (random, not the name).
- All messages are JSON with a `type` discriminator. Shared TS types live in `lib/room/protocol.ts`
  and are copied verbatim into `relay/src/protocol.ts` (two packages, no shared build step).
- Reconnect with exponential backoff (1 s .. 30 s). Room state survives reconnect.

Relay (Cloudflare Worker + Durable Object, one DO per room code):
- Accepts WebSocket upgrade on `/room/:code`. Uses Hibernation API so idle rooms cost nothing.
- Keeps an in-memory map `id -> last pos message` (rebuilt from socket attachments after
  hibernation wake). On join, sends the newcomer everyone's last `pos`.
- Broadcasts each incoming message to all other sockets in the room, stamped with the sender `id`.
  Validates: raw text < 512 bytes, valid JSON, `type` in {hello, pos}, numbers finite, `name` and
  `color` strings <= 32 chars, `map` string <= 32 chars. Drops anything else silently.
- Room code path segment must match `^[A-Z0-9]{6}$`; anything else returns 400.
- No persistence, no auth, no logging of positions. Room evaporates when the last socket closes.

### 5.7 Quests

- Data: tarkov.dev GraphQL `POST https://api.tarkov.dev/graphql`, `regular` mode only. Query
  `tasks(gameMode: regular)` with `id name trader{name} minPlayerLevel objectives{id type description
  maps{id} ... on TaskObjectiveBasic{zones{...}} ... on TaskObjectiveItem{zones{...}}
  ... on TaskObjectiveQuestItem{zones{...}} ... on TaskObjectiveMark{zones{...}}}` where zone fields
  are `id map{id} position{x y z} top bottom outline{x y z}`; and `maps(gameMode: regular)` with
  `id name normalizedName extracts{id name faction position{x y z}}`.
- Marker extraction: every zone becomes one quest marker at `position` on `map.id`. Objective type
  decides the icon (visit / item / questItem / mark). Extracts with faction `pmc` or `shared`
  become extract markers.
- Snapshot refreshed by `scripts/snapshot.ts` (run manually before a release) into
  `data/snapshot/tasks.json` and `data/snapshot/maps.json`.
- Cache: response stored in app data dir with timestamp. Refresh in background if older than 24 h.
  If API fails, use cache; if no cache, use bundled `data/snapshot/`. Never block UI on network.
- Side panel: quest list grouped by trader, filter by player level (setting) and done state,
  search box. Checkbox marks done; done quests' markers hide. Done set persisted as JSON.

### 5.8 Overlay window and hotkeys (Rust + TS)

- Single window created with `transparent: true` (WebView2 cannot toggle transparency at runtime).
  Normal mode paints an opaque background in CSS. Two modes:
  - Normal: decorated, resizable, taskbar entry.
  - Overlay (F5): undecorated, always-on-top, CSS background switched to translucent, skip taskbar.
    Alt+drag anywhere on the window moves it (window-level mousedown handler calling
    `getCurrentWindow().startDragging()`). Overlay stays interactive; no click-through in v1.
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

- `lib/parse/*`: vitest with filename fixtures (example above plus variants with and without the
  trailing float and counter) and log excerpts shaped like the real lines. Written first (TDD).
  If the user supplies a real filename or log, it is added as a fixture immediately.
- `lib/room/fade.ts`, coordinate transform: vitest, table-driven.
- Relay: vitest with `@cloudflare/vitest-pool-workers` — two clients join, one sends, other
  receives, join replays last state, oversized and malformed messages are dropped, bad code is 400.
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

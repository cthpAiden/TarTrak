# TarTrak — handoff context

Free, open-source clone of the feature set of TarkovQuestie (paid, proprietary, by zenwai).
Written 2026-09-04 after a research-only session. No code exists yet. No spec or plan has been written yet.

## Goal

Desktop Windows app for Escape from Tarkov that shows:
- interactive map with quest markers
- your own position + heading line (the original "line" indicator, NOT a view cone — decided)
- teammates' positions + heading lines via a shared room code
- quest tree, quest progress, hideout, stats panels (secondary)

Hard requirements from the user:
1. Completely free to use AND free to maintain/self-host. $0 forever.
2. Must not violate EFT TOS, must not get anyone banned. Same principles as TarkovQuestie:
   read screenshot filename coords, send to a relay, parse, update the app. Nothing else.
3. Teammates must be able to join a room and share location + heading.
4. User wants to own and modify the code freely.

## What is NOT allowed / not being built

- No decompiling or copying TarkovQuestie's code, maps, or assets. It is proprietary, paid,
  and its README forbids reverse engineering. Do not extract the PyInstaller archive.
- No enemy/scav positions, no memory reading, no DLL injection, no hooks into the game,
  no sending keystrokes to the game (no auto-PrintScreen). BattlEye bans exactly that.
- No login, license server, payments, accounts.
- No view cone. Original heading line only (user reverted this decision explicitly).

## Research findings (verified)

### TarkovQuestie itself (installed at C:\Users\datdo\AppData\Local\Programs\TarkovQuestie)
- Python 3.12 + PySide6 (Qt 6), PyInstaller onedir, ~240 MB exe. Bundles cv2, onnxruntime, pygame, rapidfuzz, psutil.
- `data/{regular,pve,pvp-season}/` = verbatim tarkov.dev GraphQL JSON: tasks, maps, traders, items,
  barters, crafts, hideout + 20 locale files. ~66 MB per mode. Nothing proprietary in it.
- Registry HKCU\Software\Tarkovquestie has subkeys: HideoutPanel, MiniTracker, StatsPanel, Workspace
  (last_tab=map, preferred_window_size=1000,600, always_on_top).
- Hotkeys: F5 overlay mode, F6 transparency, wheel zoom, drag pan, right-click menu, Alt+drag move window.
- Friends feature: observed one persistent TLS connection on 443 to a single AWS EC2 host
  (34.203.150.46, us-east-1). i.e. a self-hosted WebSocket relay on a rented VM.
- Could not screenshot its UI (game was fullscreen). Feature list came from README/QUICK_START/registry.

### Position tracking method (how every open tool does it)
- EFT writes a PNG on PrintScreen whose filename contains position + rotation quaternion.
- Regex from TarkovMonitor (GPL-3.0), file `TarkovMonitor/GameWatcher.cs` on branch `master`:
  ```
  \d{4}-\d{2}-\d{2}\[\d{2}-\d{2}\]_?(?<position>.+) \(\d\)\.png
  (?<x>-?[\d]+\.[\d]{2}), (?<y>-?[\d]+\.[\d]{2}), (?<z>-?[\d]+\.[\d]{2})_?(?<rx>-?[\d.]{1}\.[\d]{1,5}), (?<ry>...), (?<rz>...), (?<rw>...)
  ```
  Quaternion (Unity, y-up) -> yaw gives heading.
- Default screenshot dir: `C:\Users\datdo\Documents\Escape from Tarkov\Screenshots` (does not exist yet on this PC — user has not taken screenshots).
- Game logs at `D:\Escape From Tarkov\Logs\log_<date>_<ver>\`. Useful lines in `*application_000.log`:
  - `scene preset path:maps/<name>_preset.bundle`  (map about to load)
  - `TRACE-NetworkGameCreate profileStatus: ... Location: Lighthouse, ...`  (map name)
  - `MatchingCompleted`, `LocationLoaded`, `GameStarted`
  - `Position:(x, y, z)` lines exist but are RARE (only on stuck/packet events). Not usable for live tracking.
  - `*notifications_000.log` has JSON messages with MessageType TaskStarted..TaskFinished -> quest auto-progress.
  - TarkovMonitor regexes for all of the above are in GameWatcher.cs lines ~700-1000.

### Data + map sources (all free)
- tarkov.dev GraphQL: `POST https://api.tarkov.dev/graphql`. Was returning
  `{"errors":["GraphQL server unavailable. Try again later."]}` during this session (known outage
  pattern, issue #474 July 2026). MUST cache locally and degrade gracefully. TarkovQuestie's data folder
  can serve as a first offline cache for dev (it's just tarkov.dev output).
- Maps: https://github.com/the-hideout/tarkov-dev-svg-maps — layered SVG per map, floor groups.
  License CC BY-NC-SA 4.0, explicitly forbids radar/ESP use. Own-squad screenshot positions are fine
  (tarkov.dev does the same).
- Coordinate transforms: https://raw.githubusercontent.com/the-hideout/tarkov-dev/main/src/data/maps.json
  per map: `transform [scaleX, offsetX, scaleY, offsetY]`, `coordinateRotation`, `bounds`, `layers` with
  height ranges, `svgPath`, `labels`. MIT license.
- Reference implementations: TarkovMonitor (C#, GPL-3.0), Tarkov Nexus (Go+Wails, MIT, desktop source
  not yet published), TarkovMapTracker (Go, CC BY-NC-ND), TarkovPilot.

### Toolchain on this PC
- Python 3.12 (`py -3.12`), pip 25; `python` alias is the MS Store stub (broken) — always use `py -3.12`.
- Node 24, npm 11, Rust 1.97, git 2.51. No gh CLI. No .NET SDK.

## Decisions made

- Stack: DECIDED 2026-09-04 -> Tauri 2 (Rust shell + WebView2) + TypeScript frontend with Leaflet
  (tarkov.dev map code is React+Leaflet, MIT, same maps.json transforms) + Cloudflare Worker in TypeScript.
  Rust side small: window toggles, `notify` file watcher, log tail, PNG delete. WebSocket in TS.
  Rejected: PySide6 (Qt SVG Tiny 1.2 risk, 100+ MB, AV flags), Electron (150 MB), egui/.NET.
- Relay: Cloudflare Workers + Durable Objects free tier, WebSocket Hibernation API, one DO per room,
  in-memory only. No LAN mode (dropped 2026-09-04).
- Room UX: host creates 6-char code, others join with code + display name + color. Messages
  `{room, name, map, x, y, z, yaw, ts}` ~60 bytes. Marker stays at last-known position indefinitely (see decisions below).
  Client-side throttle 500 ms per player. Delete PNG right after parsing.
- Load math: 600 screenshots/raid x 15 raids = 9k msgs/day; WS messages billed 20:1 -> ~450 requests
  vs 100k/day free limit. Not a concern.
- Latency: dominated by game writing the PNG (200-500 ms). Relay adds 20-80 ms.
- Updates via GitHub Releases. Everything public on user's GitHub.

- Decided 2026-09-04 (pre-spec):
  - Default relay: user's own Cloudflare account, URL baked in as default, overridable in settings.
  - Data mode v1: `regular` only, bundled offline snapshot for first run. pve/pvp-season in v2.
  - Screenshot PNG: delete after parse by default, settings toggle to keep.
  - Rooms: 6-char code only, no passphrase. Room dies when empty.
  - Frontend: Svelte 5 + TypeScript + Leaflet.
  - Markers (own AND teammates): NEVER auto-hide or fade away. Last-known position stays on map
    with heading until next update. Show staleness (e.g. age label / dimming) but keep it visible.
    Reason: last-logged position is useful to the team (down teammate, disconnect).
    Staleness display: dim gradually, very slow, no age label. Full opacity until ~30 s, then
    fade linearly to a floor (e.g. 35 % opacity) reached at 5 min. Never below floor, never hidden.
  - LAN mode: DROPPED entirely. Internet relay only. Remove from scope.
  - Quest markers v1: objective zones + quest item pickups (tarkov.dev tasks) + PMC extracts (maps.json).
    Keys / loot spots -> v2.
  - Quest done tracking v1: manual checklist in side panel, marks quest done, hides its markers,
    persisted to local JSON (app data dir). Auto-progress from notifications log -> v2.
  - Hotkeys: F5 overlay, F6 transparency, Alt+drag move. GLOBAL (work while game focused) via
    tauri-plugin-global-shortcut. Rebindable in settings.
  - Updates: Tauri built-in updater (tauri-plugin-updater) against GitHub Releases. Needs update
    signing keypair; private key stored as GitHub Actions secret, never committed.
  - Defaults taken without asking (override if wrong): screenshot dir and log dir auto-detected,
    both overridable in settings; manual map picker as fallback when log detection fails;
    teammates shown only when on same map; display name + color persisted locally; MIT license;
    tests: vitest (TS) + cargo test (Rust); CI: GitHub Actions builds release exe.

## Scope

Core (v1):
1. Map view: all maps from tarkov.dev SVGs, floor toggle, zoom, pan, F5 overlay, F6 transparency, Alt+drag, right-click menu.
2. Own position + heading line from screenshot folder watcher; map auto-detect from log.
3. Rooms / teammates via relay (Cloudflare). No LAN mode.
4. Quest markers from tarkov.dev tasks (zones, items), filter by trader/level/done.

Secondary (v2):
5. Quest tree with dependencies and progress.
6. Auto quest progress from notifications log.
7. Hideout, stats, mini tracker panels.
8. regular / pve / pvp-season data modes.

## Next steps (user said: do NOT write specs/plans until told "go")

1. User picks stack: Python+PySide6 or Tauri.
2. Then run brainstorming -> write spec -> write plan (superpowers skills), in this folder.
3. Set up repo in this folder (`git init`), MIT license, README stating the safety principles.
4. Build order: screenshot parser + log map detection (pure logic, TDD) -> map render with transforms
   -> own marker -> relay + rooms -> quest markers -> the rest.

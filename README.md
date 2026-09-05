# TarTrak

Free, open-source Windows companion for Escape from Tarkov: an interactive map with your own position and
heading, your teammates' positions via a shared room code, and quest markers. MIT licensed.

## How it stays ban-safe

TarTrak never touches the game process. It only:

- reads the **filenames** of screenshots the game writes (they contain your coordinates and camera rotation), then deletes the PNG (optional);
- reads the game's **text log** to learn which map you loaded.

No memory reading, no injection, no hooks, no keystrokes sent to the game, no accounts, no telemetry.

## Use

1. Install the latest release from GitHub Releases (NSIS installer, per-user).
2. Start the game in **borderless windowed** mode so the overlay can sit on top.
3. In raid, press your screenshot key (PrintScreen by default). Your marker appears on the map.
4. Team: one player presses **Create**, shares the 6-character code; others enter it and press **Join**.
   Positions travel through the project relay (`wss://tartrak-relay.aidenmileshp.workers.dev`); you can
   point Settings > Relay URL at your own Worker instead (see [Relay](#relay)).
5. Hotkeys: `F5` overlay mode, `F6` opacity, `Alt+drag` moves the overlay. Rebind in Settings. The square
   button in the map's top-left corner also switches between the full window and the map-only overlay; the
   crosshair next to it toggles **follow me**, which recentres the map on your marker after every screenshot.

Markers never disappear; they dim slowly after 30 s and settle at 35% after 5 minutes.

**Squad.** Every player marker has a heading line and a translucent view cone (turn the cone off in
Settings). While you are in a room, the Squad tab lists your teammates: distance to you when they are on
your map, otherwise the map they are on, plus how long ago they last reported. Click a row to center on them.
A teammate whose game log was not found reports no map and is drawn on yours, marked "map unknown". The app
pings the relay every 20 s; if the connection drops, a small "Squad: reconnecting" pill appears next to the
corner button and the app reconnects by itself, with one notice on loss and one on recovery.

**Details.** Click any marker for a popup with its name, type, elevation, and, for loose loot, the full item
list; boss spawns show each boss with its spawn chance.

**Filters.** The sidebar has four tabs: Filters, Squad, Quests and Settings. The Filters tab groups
everything the map can draw: Extracts, Map
Tasks, Spawns, Containers, Locks, Hazards, Switches and BTR. Each group and each category shows a
`shown/total` count for the current map, so a group with nothing on this map still appears as `0/0`.
PMC, co-op and transit extracts plus every map task category are on by default; everything else is
off. Your choices are saved with the rest of your settings. The filter counts are for the whole
map; the map itself shows only markers on the selected floor.

**Find item.** The Filters tab has a "Find item on map" box: type part of an item name (two letters or
more) and every loose-loot spot holding it, every lock opened by a key of that name and every stationary gun
of that name lights up on the current map, whatever the layer toggles say. The box shows how many spots matched.

**Game mode.** Settings > Game mode picks the tarkov.dev data set: PvP (default) or PvE. Each mode keeps its
own cache; the quest list footer shows which one is loaded.

**Quest list.** Quests are grouped by trader in the usual trader order, with a `done/total` count per
trader; sections collapse and quests with markers on the current map sort first. The checkbox marks a
quest done, and the eye button hides one quest's markers from the map without marking it done.

## Relay

Positions go through a tiny Cloudflare Worker (`relay/`). It keeps nothing, logs nothing, needs no account.

The default relay (`DEFAULT_RELAY_URL` in `src/lib/settings/store.ts`) is
`wss://tartrak-relay.aidenmileshp.workers.dev`, hosted by the project on the Cloudflare free tier. To run
your own, deploy `relay/` (`cd relay && npm ci && npx wrangler deploy`) and paste the resulting
`wss://...workers.dev` URL into Settings > Relay URL.

## Build from source

Node 24, Rust stable (MSVC), WebView2 (ships with Windows 10/11).

    npm ci
    npm test
    npm run tauri dev

Pushing a `v*` tag runs `.github/workflows/release.yml`, which builds the installer, signs it and creates a
**draft** GitHub Release. Publish that draft by hand - the updater only sees a published release.

The updater private key lives only in the `TAURI_SIGNING_PRIVATE_KEY` repository secret (with
`TAURI_SIGNING_PRIVATE_KEY_PASSWORD` for its passphrase). The updater endpoint in
`src-tauri/tauri.conf.json` `plugins.updater.endpoints` points at the `cthpAiden/TarTrak` releases; forks
must change the owner there.

Quest data is fetched live from tarkov.dev and cached locally. `npm run snapshot` writes an offline
fallback into `data/snapshot/` (PvP data), used when tarkov.dev is unreachable and no cache exists; refresh
it before tagging.

## Credits and licenses

- Map images: [tarkov-dev-svg-maps](https://github.com/the-hideout/tarkov-dev-svg-maps), CC BY-NC-SA 4.0, fetched at runtime.
- Map transforms and quest data: [tarkov.dev](https://tarkov.dev) (MIT). Coordinate math adapted from tarkov.dev.
- Marker icons: [the-hideout/tarkov-dev](https://github.com/the-hideout/tarkov-dev) `public/maps/interactive` (MIT), copied to `public/icons/` with its licence.
- Screenshot filename format documented by the community (TarkovMonitor).

Escape from Tarkov is a trademark of Battlestate Games. TarTrak is not affiliated with or endorsed by them.

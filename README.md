# TarTrak

Free, open-source Windows companion for Escape from Tarkov: an interactive map with your own position and
heading, your teammates' positions via a shared room code, and quest markers. MIT licensed.

## How it stays ban-safe

TarTrak never touches the game process. It only:

- reads the **filenames** of screenshots the game writes (they contain your coordinates and camera rotation), then deletes that PNG (optional; only screenshots named with coordinates are deleted, menu screenshots stay);
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

**Your own markers.** Right-click anywhere on the map, type a label if you want one, and pick **Marker for
me** (only this app shows it) or **Shared marker** (everyone in your squad room sees it, in your colour).
Click a marker for its details and a Remove button; anyone in the room can remove a shared marker. Shared
markers live as long as the room does, and go away when you leave it.

**Route and drawings.** The exit button next to Follow me lists the map's extracts; pick one and a dashed line
runs from your marker to it with the distance in metres, updated on every screenshot. **Go here** on the
right-click menu draws the same line to any spot on the map; the route button clears either. The pencil button turns a
left drag into a stroke: in a room the squad sees every stroke live and later joiners get them replayed; right-click
offers undo (also Ctrl+Z) and clear-all, which wipes the map for the whole room.

**Quests.** The Quests tab is a to-do list. "Find quests on <map>" lists the quests with markers on the map you
are on (type to search, "all maps" widens it). Tick a quest there to put it on your to-do; only to-do quests draw
markers, and the checkbox on a to-do entry marks it done.
"Share with squad" sends the list to your room, so teammates see those markers too and can copy quests over.

**Squad.** Every player marker has a heading line (length adjustable in Settings). While you are in a room, the Squad tab lists your teammates: distance to you when they are on
your map, otherwise the map they are on, plus how long ago they last reported. Click a row to center on them.
Names carry the floor a teammate is on, like "Aiden [2F]". Click the colour dot in a row to pick the colour that
teammate is drawn in on your screen; it is yours alone, they keep their own colour on theirs (↺ goes back).
A teammate whose game log was not found reports no map and is drawn on yours, marked "map unknown". The app
pings the relay every 20 s; if the connection drops, a small "Squad: reconnecting" pill appears next to the
corner button and the app reconnects by itself, with one notice on loss and one on recovery.

**Details.** Click any marker for a popup with its name, type, elevation, and, for loose loot, the full item
list; boss spawns show each boss with its spawn chance, escort size and whether a switch spawns it. A loose loot
spot holding one item is drawn as that item's picture, one whose items share a handbook category as the category's
picture (both from assets.tarkov.dev, like tarkov.dev's map); popups also show a lock's key, an extract's fee item
and a quest item. Quest objectives with a zone draw its footprint
as a translucent green outline, shown on every floor the zone spans. The "?" button next to a quest opens its
wiki page in your browser.

**Filters.** The sidebar has four tabs: Filters, Squad, Quests and Settings. The Filters tab opens with a card
for the current map: raid length, player count, the keys needed to get in (The Lab, Terminal, The Labyrinth), and
every boss with its spawn chance and escort size. Below it the tab groups
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
own cache; the quest list footer shows which one is loaded. Settings > PMC faction (USEC or BEAR) hides the
quests only the other faction gets; those quests carry a USEC or BEAR badge.

**Quest list.** Quests are grouped by trader in the usual trader order, with a `done/total` count per
trader; sections collapse and quests with markers on the current map sort first. The checkbox marks a
quest done. Quests needed
for Kappa carry a "κ" badge, Lightkeeper ones "LK"; the **Kappa** toggle lists only those. The **available**
toggle (saved with your settings) shows only quests whose prerequisite quests you have marked done, and hides
the markers of the locked ones from the map as well. Click a quest's name to unfold it: every objective with
its count and found-in-raid flag, what still gates it (prerequisites left, trader loyalty level, faction), the
rewards, and what would fail it.

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

Pushing a `v*` tag (matching the version in `src-tauri/tauri.conf.json`, `package.json` and
`src-tauri/Cargo.toml`) runs `.github/workflows/release.yml`, which builds the installer, signs it and publishes
a GitHub Release with `latest.json`. Installed apps check that manifest at every start and offer the update
(Settings > About > Check for updates does it on demand); the installer runs with a progress bar and relaunches
the app.

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
- Trader portraits in `public/icons/traders/`: Battlestate Games' artwork as served by tarkov.dev (assets.tarkov.dev); not covered by the MIT licence.
- Screenshot filename format documented by the community (TarkovMonitor).

Escape from Tarkov is a trademark of Battlestate Games. TarTrak is not affiliated with or endorsed by them.

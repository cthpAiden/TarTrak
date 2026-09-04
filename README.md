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
   **Rooms do not work in v1 out of the box:** the built-in relay URL is a placeholder that does not
   resolve. Everyone in the team must paste the same working relay URL into Settings > Relay URL first
   (see [Relay](#relay)). Everything else - your own position, the map, quest markers - works without it.
5. Hotkeys: `F5` overlay mode, `F6` opacity, `Alt+drag` moves the overlay. Rebind in Settings.

Markers never disappear; they dim slowly after 30 s and settle at 35% after 5 minutes.

## Relay

Positions go through a tiny Cloudflare Worker (`relay/`). It keeps nothing, logs nothing, needs no account.

`DEFAULT_RELAY_URL` in `src/lib/settings/store.ts` currently holds the placeholder
`wss://tartrak-relay.example.workers.dev`, which does not resolve, so rooms fail to connect until either
the project owner deploys the Worker and replaces that constant, or each user pastes a relay URL into
Settings > Relay URL.

To run your own: `cd relay && npm ci && npx wrangler deploy`, then paste the URL into Settings > Relay URL.

## Build from source

Node 24, Rust stable (MSVC), WebView2 (ships with Windows 10/11).

    npm ci
    npm test
    npm run tauri dev

Pushing a `v*` tag runs `.github/workflows/release.yml`, which builds the installer, signs it and creates a
**draft** GitHub Release. Publish that draft by hand - the updater only sees a published release.

The updater private key lives only in the `TAURI_SIGNING_PRIVATE_KEY` repository secret (with
`TAURI_SIGNING_PRIVATE_KEY_PASSWORD` for its passphrase). Before the first release, replace the owner
placeholder `cthpAiden` in `src-tauri/tauri.conf.json` `plugins.updater.endpoints` with the real
GitHub owner.

Quest data is fetched live from tarkov.dev and cached locally. `npm run snapshot` writes an offline
fallback into `data/snapshot/`, used when tarkov.dev is unreachable and no cache exists; refresh it before
tagging. No snapshot ships in v1 - tarkov.dev was returning errors when this release was cut - so a first
run with tarkov.dev down shows no quest markers.

## Credits and licenses

- Map images: [tarkov-dev-svg-maps](https://github.com/the-hideout/tarkov-dev-svg-maps), CC BY-NC-SA 4.0, fetched at runtime.
- Map transforms and quest data: [tarkov.dev](https://tarkov.dev) (MIT). Coordinate math adapted from tarkov.dev.
- Screenshot filename format documented by the community (TarkovMonitor).

Escape from Tarkov is a trademark of Battlestate Games. TarTrak is not affiliated with or endorsed by them.

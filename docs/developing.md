# Developing TarTrak

Back to the [README](../README.md).

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
a GitHub Release with `latest.json`. Without git, Actions > release > Run workflow on `main` does the same and
creates the tag `v<version>` itself; it refuses a version that is already tagged. Installed apps check that manifest at every start and offer the update
(Settings > About > Check for updates does it on demand); the installer runs with a progress bar and relaunches
the app.

The updater private key lives only in the `TAURI_SIGNING_PRIVATE_KEY` repository secret (with
`TAURI_SIGNING_PRIVATE_KEY_PASSWORD` for its passphrase). The updater endpoint in
`src-tauri/tauri.conf.json` `plugins.updater.endpoints` points at the `cthpAiden/TarTrak` releases; forks
must change the owner there.

Quest data is fetched live from tarkov.dev and cached locally. `npm run snapshot` writes an offline
fallback into `data/snapshot/` (PvP data), used when tarkov.dev is unreachable and no cache exists; refresh
it before tagging.

`data/extracts.json` lists every extract of every map, checked against sources independent of tarkov.dev,
and is what the app draws: an extract tarkov.dev still lists is drawn as tarkov.dev has it, one it dropped
comes from the file, one the file does not know is left off (tarkov.dev's September 2026 data regeneration
lost five of Lighthouse's extracts and filed Woods' UN Roadblock under Ground Zero, among others). A map the
file does not cover takes tarkov.dev's list as it comes. `npm run snapshot` prints what the file restored and
what upstream lists that the file left off, so it can be kept current when a patch changes a map.

## Website

`site/` is the promo page at https://cthpaiden.github.io/TarTrak/, plain HTML, CSS and JS with no build step.
`.github/workflows/pages.yml` publishes it whenever `site/` changes on `main`; Pages must be set to
"GitHub Actions" once, under Settings > Pages > Source. Preview it locally with
`python -m http.server -d site`. The page asks the GitHub API for the latest release and shows its version,
date and installer link, so it needs no edit per release; the numbers written in the HTML are only the
fallback. `site/media/showreel.mp4` and `poster.jpg` come from `promo/` (`npm run render`, the web copy
and the last frame). Fonts are self-hosted with their OFL licences in `site/fonts/`.

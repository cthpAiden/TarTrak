# Security

## Reporting a vulnerability

Please report it privately through [GitHub's advisory form](https://github.com/cthpAiden/TarTrak/security/advisories/new),
not in a public issue. Say what you found, how to reproduce it, and which version you used.

Only the latest release is supported: the app updates itself, so a fix ships as a new release.

## What TarTrak sends and stores

- **Squad rooms.** While you are in a room, your name, colour, map and position go to the relay (a Cloudflare
  Worker, `relay/`) and on to everyone in the same room. The six-character room code is the only key to a room,
  so share it only with your squad. The relay keeps shared markers and drawings until the room has been empty for
  30 minutes; a shared to-do list goes when you leave. Worker logs are turned off.
- **Game data.** Quest and map data is downloaded from tarkov.dev and cached in the app's data folder.
- **Your PC.** Settings, quest progress and the cache stay in the app's data folder. Screenshots the game names
  with coordinates are deleted after they are read, when that setting is on.

## How the app is protected

- **It runs elevated.** The game runs as administrator, and Windows hides its key state from programs that do not
  (see `src-tauri/windows-app-manifest.xml`). Everything below is there to keep that window from ever running
  someone else's code.
- **Signed updates.** Updates come from GitHub Releases and are installed only when their signature matches the
  public key built into the app. The release workflow pins every action to a commit.
- **Locked-down webview.** A strict Content Security Policy (no inline or remote scripts, no plugins, frames or
  forms), a navigation guard that keeps the window on the app's own pages, and Tauri permissions limited to what
  the page uses: it may open https links only, download data only from tarkov.dev, and reach files only in the
  app's data folder.
- **Untrusted input.** Everything from the relay and from tarkov.dev is validated and escaped before it reaches
  the page, and map SVGs are sanitized.
- **Relay limits.** Message size and rate limits per socket, storage caps per room, a request limit per IP,
  and only the app's own pages may open a room from a browser.

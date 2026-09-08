# Raid timer, Mountain Pass move, Lighthouse minefields off (0.7.4)

Date: 2026-09-09. Approved by the user in chat.

## 1. Raid timer pill (overlay only)

**What.** A small pill in the map's bottom-left corner, shown only in overlay mode, reading the time
left in the raid as `mm:ss`. Same look as the teammate-distance pill in the bottom-right
(`MateReadout.svelte`): 26 px tall, translucent panel background, monospace tabular digits,
`pointer-events: none` so it never blocks the map.

**Start signal.** The game log's `GameStarted:` line is written the second the player spawns. For
PMC raids that is the moment the in-game clock starts. `parseLogLine` now returns
`{ kind: "gameStarted", at: number }` with the line's timestamp (`YYYY-MM-DD HH:MM:SS.mmm`, local
time) parsed to epoch ms; `at` is `NaN`-free or the event is dropped. `AppState` gains
`raidStartedAt: number | null`, set by `handleLogLine` on `gameStarted`, cleared when the map
changes. Time left = `raidDuration * 60 s - (now - raidStartedAt)`, `raidDuration` from the current
map's `MapInfo` (tarkov.dev, minutes).

**Replay.** The Rust tail replays the whole log at startup, so an old `GameStarted` arrives with an
old timestamp. Because the timestamp is parsed, an old raid computes as already over and the pill
hides; no replay flag is needed.

**Ticking.** A one-second `setInterval` in `App.svelte` while overlay is on and a raid start is
known; stops otherwise.

**Visibility.** Shown while `0 <= left`. At `left < 0` it shows `00:00` for 60 s, then hides. Hidden
when `raidStartedAt` is null, `raidDuration` is unknown, or the Settings toggle **Raid timer** (new
`Settings.raidTimer: boolean`, default `true`) is off.

**Known limits, told to the user.** Scav raids join mid-raid and the log carries no remaining-time
value, so a Scav raid reads too high; the log does not say which side the player is on. The user
verifies the PMC case against the in-game watch in one raid.

## 2. Mountain Pass (Lighthouse) moved

Patch 1.1.5.0 moved the extract. tarkov.dev still lists the old spot. In `data/extracts.json` the
Lighthouse `Mountain Pass` entry moves to `x -182, y 41.89, z -71` with a 26 m by 20 m outline
centred on it; `top`/`bottom` unchanged. Estimated from the user's screenshot against the map's
label anchors, plus or minus about 7 m; refined later from a screenshot filename taken at the spot.

**Override flag.** `mergeExtracts` keeps upstream's entry for every name the file knows, so the
file's own coordinates only fill gaps today. A curated entry with `"pinned": true` now replaces
upstream's entries of that name instead (all factions of that name). `npm run snapshot` reports
pinned names as "pinned in data/extracts.json" so the flag is re-checked before each release. The
`pinned` field is stripped from the merged output type consumers see (it is not a `MapExtract`
field; the type gains an optional `pinned?: true` on the curated shape only).

## 3. Lighthouse minefields off

The patch removed Lighthouse's landmines. `toMap` in `jsonSource.ts` drops hazards with
`hazardType === "minefield"` when `normalizedName === "lighthouse"`. Other maps keep theirs. The
Filters tab then shows Minefields as `0/0` on Lighthouse. `QUEST_SCHEMA_VERSION` bumps to 14 so
cached data is rebuilt; `npm run snapshot` regenerates the bundled fallback.

## 4. Release

Version 0.7.4 in `package.json`, `package-lock.json` (2 places), `src-tauri/tauri.conf.json`,
`src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`. CHANGELOG entry. Commit to main, tag `v0.7.4`,
push; CI builds and publishes.

## Tests

- `log.test.ts`: `gameStarted` carries the parsed timestamp; a malformed timestamp yields null.
- `events.test.ts`: `handleLogLine` sets `raidStartedAt`; a map change clears it.
- New `raidTimer.test.ts`: `formatLeft(startedAt, durationMin, now)` returns `mm:ss`, `00:00` in the
  minute after the end, and null after that or without inputs.
- `curatedExtracts.test.ts`: a pinned entry replaces upstream's same-name entries; the shipped
  Lighthouse Mountain Pass is pinned at the new spot.
- `snapshot.test.ts`: Lighthouse has no minefield hazards; Woods still does.

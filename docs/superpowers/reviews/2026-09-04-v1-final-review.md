# TarTrak v1 — final whole-branch review

Range: `c96ed26..618d3b2` (29 commits). Read-only review of the working tree at HEAD. Suites were run by the
controller (frontend 134/134, relay 7/7, cargo 11/11) and were not re-run. Beyond reading, the following
focused checks were made because reading alone could not settle them:

- Tauri plugin permission sets in the cargo registry (`tauri-plugin-fs 2.5.2`, `-dialog 2.7.3`, `-store 2.4.4`,
  `-http 2.6.0`, `-process`, `-updater`), `tauri-codegen 2.6.3` and `tauri-macros` — to confirm every
  frontend call is actually permitted and that the CI rust job compiles without `dist/`.
- One real map SVG (`https://assets.tarkov.dev/maps/svg/Customs.svg`) and Interchange, plus upstream
  `maps.json`, to check the nested-SVG loader and the floor-group toggling against real data.

Everything below that says "verified" refers to one of those checks.

## Strengths

- **Ban-safety holds end to end.** The Rust side is exactly the spec's footprint: `notify` on one folder
  (`src-tauri/src/watcher.rs`), a polling text tail (`src-tauri/src/logtail.rs`), a read of one HKLM
  registry value (`src-tauri/src/detect.rs:29-48`), and PNG deletion inside the watched folder. No
  process handles, no input, no memory. Rust does no parsing, as the plan demands.
- **Capabilities are correct and nearly minimal (verified).** `fs:allow-appdata-write-recursive` expands to
  `write-all` + `$APPDATA/**` scope, `dialog:default` covers `ask()` because the JS `ask` routes through
  `plugin:dialog|message`, `store:default`/`process:default`/`updater:default` cover every call made. The
  http scope is an explicit allow-list. The updater public key is the only key material in the repo;
  `git log --all` shows no key file was ever committed.
- **Protocol and relay are tight.** `src/lib/room/protocol.ts` enforces the byte limit as `< 512`, string
  bounds, finite numbers, null-vs-string `map`, and the relay copy is byte-identical (CI `cmp` guards it).
  The Durable Object rebuilds state from socket attachments after hibernation, never stores anything,
  announces `leave` exactly once (`announceLeave` clears the attachment), and 400s malformed percent
  escapes without touching `decodeURIComponent`. `relay/test/room.test.ts` exercises real behaviour:
  replay to newcomers, no echo, dropped garbage, room isolation, single leave.
- **Map math matches tarkov.dev exactly.** `makeCrs`/`rotate`/`boundsOf` in `src/lib/map/crs.ts` are the
  same transform, the `[z, x]` latlng convention is used consistently in `markers.ts`, `MapView.svelte`
  and the quest layer, and `markers.test.ts` pins the heading direction against Customs' 180-degree
  rotation. The heading line uses `project()` rather than `latLngToLayerPoint()` to avoid rounding
  collapse — a subtle detail handled correctly.
- **Startup is genuinely isolated.** `App.svelte:133-172` runs each phase in its own try or catch, the dir
  state only flips once the backend accepted the folder (so a moved folder keeps the banner), the event
  bridge is subscribed before the watcher starts (no lost events), and the async `build()` in MapView is
  generation-guarded so a fast map switch cannot resurrect a torn-down Leaflet map.
- **Tests test behaviour.** 56 real screenshot filenames plus the menu shape are fixtures; the throttle test
  advances 499 then 1 ms; the backoff test walks 1, 2, 4 .. 30 s and asserts the reset after a successful
  open; byte-boundary tests hit 511/512 exactly; the Rust watcher test uses a real filesystem event and a
  real retry-delete; the log tail test proves replay, streaming and directory switching.
- **Reactivity is handled with care.** `$state.raw` for the large quest payloads, `untrack` where effects
  assign the state they read, Leaflet instances (non-POJO) kept in `$state` without deep proxying issues,
  and a single 1 s ticker driving fade.

## Issues

### Critical (Must Fix)

None found. Nothing in the branch crashes at startup, breaks the own-position path, or violates the ban-safe
or $0 constraints.

### Important (Should Fix)

1. **Every teammate reconnect leaves a ghost marker.**
   `relay/src/room.ts:14` assigns a fresh 8-hex id per socket; `src/lib/room/client.ts:138-146` reconnects
   with backoff after any drop; `src/lib/room/controller.svelte.ts:38-42` deliberately keeps the marker on
   `leave`. Combined: a Wi-Fi hiccup on Bob's side produces `leave(old)` then `pos(new id)`, so Bob's
   teammates see two "Bob" markers forever (one frozen), and Bob himself becomes a ghost on everyone
   else's map on each reconnect. Per-task reviews could not see this because each half is correct alone.
   Fix: on `leave`, mark the teammate `left: true` (keep the marker, spec-compliant); on `hello`/`pos` from a
   new id whose `name` matches a `left` teammate, remove the ghost first. Add a controller test for the
   sequence pos(A) -> leave(A) -> pos(B, same name).

2. **A relay URL without a scheme throws out of `join()` and out of the reconnect timer.**
   `src/lib/room/client.ts:119` calls `new WebSocket(roomUrl(...))` with no try/catch; `roomUrl()` (line 32)
   only rewrites `http(s)`. A user pasting `tartrak-relay.foo.workers.dev` into Settings > Relay URL
   (the README tells them to paste a URL) gets a synchronous `SyntaxError` from `RoomPanel.svelte:28` or
   from `applySettings()` in `App.svelte`, `room.code` is already set so the panel shows "Leave XXXXXX"
   with a red dot and no message, and the reconnect loop dies silently if it happens in the timer.
   Fix: in `roomUrl`, prepend `wss://` when the string has no scheme; in `open()`, wrap the factory call in
   try/catch, set status `closed`, and surface the error via a new `onError` callback (or schedule a
   reconnect). Add tests for both.

3. **Screenshot folder retry (spec section 7) is not implemented.**
   Spec: "Screenshot dir missing: banner ... Watcher retries every 10 s." `App.svelte:163` tries once at
   startup and then only on "Pick folder". EFT creates `Documents\Escape from Tarkov\Screenshots` on the
   first screenshot ever, so a first-time user (this very machine, per HANDOFF.md) sees the banner, takes
   a screenshot in raid, and nothing happens until they alt-tab out and click the picker. Fix: while
   `screenshotsDir` is null, run `useDir("screenshots", ...)` on a 10 s interval (stop it once armed).

4. **No CSP plus a permissive SVG sanitizer, with remote markup injected via `innerHTML`.**
   `src-tauri/tauri.conf.json:27` has `"csp": null`; `src/lib/map/svgLoader.ts:9-19` strips only `<script>`
   and `on*` attributes. A `javascript:` `href` on an `<a>`, a `<foreignObject>` with HTML, or an animated
   `href` survives, and a click would run script with full IPC access — which includes
   `start_screenshot_watcher(dir, delete=true)` on any folder. The source is a single HTTPS host, so
   likelihood is low, but the two fixes are cheap: (a) in `sanitize`, drop `href`/`xlink:href` values that
   do not start with `#`, remove `foreignObject`, `set`, `animate*` elements; (b) set a CSP such as
   `default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src ipc: http://ipc.localhost`
   (`'unsafe-inline'` for styles is required: the real SVG carries a `<style>` block, verified). Extend
   `svgLoader.test.ts` with the `javascript:` and `foreignObject` cases.

5. **`showFloor` hides every top-level group it does not know about; on Customs that is real map content.**
   `src/lib/map/svgLoader.ts:45` toggles `hidden-layer` on every `<g id>` that is neither base nor the
   selected floor. Verified against the live `Customs.svg`: its top-level groups are `Ground_Level`,
   `Underground_Level`, `First_Floor` (106 elements), `Second_Floor`, `Third_Floor`, and neither the
   vendored nor upstream `maps.json` references `First_Floor` for Customs (Interchange does map
   "2nd Floor" to `First_Floor`, so `First_Floor` on Customs is most likely ground-floor interiors drawn in
   European numbering). TarTrak therefore never shows those 106 elements. Fix: only toggle groups that
   appear in `def.svgLayer` or `def.layers[].svgLayer`; leave unreferenced groups untouched (what
   tarkov.dev's reference behaviour amounts to). Verify visually on Customs once the GUI runs.

6. **The GUI has never been launched.** Multiple deferred notes say "runtime GUI unverified (loopback
   blocked in agent shell)". Static review confirms the permission identifiers, command argument names
   (`logsRoot` -> `logs_root`, `delete` -> `delete`), the nested-SVG sizing (the real root has a `viewBox`
   and no `width`/`height`, so the nested `<svg>` fills the wrapper 1:1), and the transparent-window flags,
   but overlay mode, Alt+drag, global F5/F6 and the Leaflet layout in WebView2 must be exercised once by a
   human before this is called done. This is a process gap, not a code defect, but it is the largest
   remaining risk.

### Minor (Nice to Have)

- `src/lib/quests/QuestPanel.svelte:61`: an emptied level field yields `Number("") = 0` (fine) but a
  non-numeric paste yields `NaN`, and `visibleQuestMarkers(..., NaN)` hides every marker until restart
  (`NaN <= 0` and `minLevel <= NaN` are both false). Clamp with `Number.isFinite(n) ? Math.max(0, n) : 0`.
- `src/lib/tauri/updater.ts:11` toasts "Update check failed" on every launch while offline, and on every
  launch for everyone until the `tartrak-placeholder` endpoint is replaced. Log it instead of toasting;
  keep the toast for a failed install.
- `src/lib/settings/SettingsPanel.svelte:50,58`: a hotkey string that normalizes to `null` (e.g. `Ctrl+`)
  is persisted and the key silently stops working. Toast when `normalizeHotkey` returns null.
- `src/lib/settings/store.ts:58`: `mergeSettings` accepts `name` longer than 32; the relay then drops every
  `hello`/`pos` silently and the user is invisible with a green dot. Clamp `name`/`color` to 32 and
  `lineLengthPx` to `[8, 120]` on merge.
- `src/lib/room/controller.svelte.ts:11`: joining does not send the current `app.ownPos`; teammates see the
  newcomer only after their next screenshot. Call `sendPosition` after `connect()` when a position exists.
- `src/lib/room/controller.svelte.ts:58`: replayed positions get `receivedAt = now`, so a teammate idle for
  10 minutes appears at full opacity to a newcomer. Acceptable for v1; note it.
- `src/lib/quests/cache.ts:53`: cached JSON is not shape-checked; a valid-JSON-but-wrong-shape file would
  throw inside a `$derived` in `App.svelte` and blank the app. Check `Array.isArray(tasks/maps)` and
  `typeof fetchedAt === "number"` before returning.
- `src-tauri/src/logtail.rs:105`: the whole application log is replayed on every (re)start through one IPC
  event per line; multi-MB logs mean tens of thousands of events at startup and a burst of "Unknown map"
  toasts. Consider replaying only the last N KB, or emitting lines in batches.
- `src-tauri/capabilities/default.json:12-16,22,37`: `core:window:allow-set-size/set-position/inner-size/
  outer-position/is-decorated`, `global-shortcut:allow-unregister-all` and the
  `raw.githubusercontent.com` http scope are unused by the frontend. Remove for least privilege.
- Spec 5.7 says the quest list is "grouped by trader"; `QuestPanel` sorts by on-map count, then trader.
  Fine as a deviation, but state it in the spec deviations list.
- Spec 7 says the SVG failure message has a "retry button"; `MapView.svelte` shows the message only
  (re-picking the map retries). Document or add the button.
- `HANDOFF.md:4` still says "No code exists yet"; it is now a historical note and should say so or move
  under `docs/`.
- README: mention that F5/F6 are global hotkeys and are swallowed for every application (including the
  game and browsers) while TarTrak runs, and that the update check will report an error until the
  release endpoint is configured.
- The injected SVG's `<style>` rules (`.floor`, `.task`, `.shadow`, ...) land in the document stylesheet
  scope. No collision with current app classes (Svelte scopes its own), but a future `.task` or `.shadow`
  class in the app would inherit `fill`/`filter`. Worth a comment in `svgLoader.ts`.

## Deferred-minors triage

Now must-fix (folded into the Important/Minor items above):

- **Task 4 `csp: null`** and **Task 10 sanitizer gaps (`javascript:` hrefs, `foreignObject`)** — together they
  form Important #4. One is not enough without the other.
- **Task 15 NOTE: `data/snapshot` has no JSON** — not a code change, but `npm run snapshot` must be retried
  and the result committed before tagging v0.1.0, or the README's "no snapshot ships in v1" stays true and
  first-run-offline users see no quests. Treat as a release-checklist item, not a merge blocker.
- **Task 16 playerLevel not clamped** — upgraded to Minor-with-fix because `NaN` hides every quest marker.
- **Task 14 mergeSettings has no bounds** — upgraded to Minor-with-fix because an over-long name makes the
  user silently invisible in the room.
- **Task 19 startup update check has no opt-out** — Minor-with-fix (silence check failures) because the
  placeholder endpoint guarantees an error toast on every launch today.

Stay deferred (correctly minor, no user-visible consequence in normal use):

- Task 2 (doc comment, fixture path resolution), Task 3 (`LOCATION_RE` anchor), Task 4 (unreferenced icons),
  Task 5 (Create dedupe, discarded delete result, missing not-a-directory test), Task 6 (mtime test
  discrimination, truncation guard, non-deterministic `find_application_log`, non-atomic restart),
  Task 8 (unknown-map toast dedupe — mitigated further if the replay is bounded), Task 9 (casts,
  memoization, tsconfig include), Task 10 (zoom animation, non-atomic cache write, `linePoints` typing),
  Task 11 (`pickDir` `.catch`), Task 12 (UTF-16 lengths — both sides agree), Task 13 (`/room/` 404,
  id collision odds, protocol drift — now guarded by CI `cmp`), Task 14 (`Date.now` throttle, hello toast,
  non-re-entrant `connect`, untested controller — the controller test recommended in Important #1 covers
  part of this), Task 15 (stale+fail combo untested, Windows exit 127, query duplication),
  Task 16 (`doneLoaded` retry — by design), Task 17 (About links without opener plugin, `aria-expanded`,
  `lineLen 0`), Task 18 (`armHotkeys` race, overlay/opacity not persisted, unmount during in-flight arm).

## Recommendations

1. Fix Important #1-#5 in one short fix round; each is a small, local change with an obvious test
   (controller ghost test, `roomUrl` scheme test, sanitizer cases, `showFloor` unreferenced-group test,
   a retry-interval test in App or a tiny helper).
2. Run the app once on this machine (`npm run tauri dev`) and walk the manual checklist from spec
   section 8: overlay over borderless EFT, F5/F6 while the game has focus, Alt+drag, Customs with a
   screenshot on the dorms 2nd floor, two clients in one room with the local relay (`cd relay && npm run
   dev`, relay URL `http://localhost:8787`). Record the outcome in the review folder.
3. Before tagging: rerun `npm run snapshot`; replace `tartrak-placeholder` in `tauri.conf.json` and
   `DEFAULT_RELAY_URL` in `store.ts` with the deployed values; set both signing secrets (the
   `_PASSWORD` secret must exist even if empty — document this next to the key generation step).
4. Keep the deferred list as the v1.1 backlog; the bounded-log-replay and cache shape check are the two
   with the best cost/benefit.

## Assessment

**Ready to merge?** With fixes

**Reasoning:** The architecture, safety boundary, permissions, protocol and tests are sound and verified
against the real plugin and data sources, with no critical defects; but five cross-task integration issues
(ghost markers on reconnect, unhandled scheme-less relay URL, missing folder retry, CSP/sanitizer, hidden
Customs groups) plus a never-launched GUI should be closed before v1 is called done.
